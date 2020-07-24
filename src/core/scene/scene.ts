import parser from 'fast-xml-parser';
import { Subject, BehaviorSubject } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

import Internal from 'internal';
import Xjs from 'core/xjs';

import isSplitMode from 'helpers/is-split-mode';
import unescape from 'lodash/unescape';

import { SceneInfo, Placement, SceneId, SceneIndex, Item } from './types';
import { IEmitEvent } from '../event/types';

const EVENTS = {
  SCENE_ADD: 'OnSceneAdd',
  SCENE_DELETE: 'OnSceneDelete',
  SCENE_CHANGE: 'SceneChange',
  SPLIT_MODE_GET: 'scenedlg:1',
  SCENE_DELETE_ALL: 'OnSceneDeleteAll',
};

const USER = 'user';
const INTERNAL = 'internal';
const I12 = 'i12';

let getSplitModeActiveScene = false;

const scenesListChange$ = new Subject();
const scenesList$ = new BehaviorSubject('');

class Scene {
  private internal: Internal;

  constructor({ internal, isRemote }: Xjs) {
    this.internal = internal;

    // for proxy and local only
    if (!isRemote()) {
      const getScenesIds = (): Promise<string> =>
        this.listAll().then((scenesList) =>
          scenesList.map(({ id }) => id).toString()
        );

      getScenesIds().then((sceneIdList) => scenesList$.next(sceneIdList));

      scenesListChange$
        .pipe(
          debounceTime(100),
          map((e) => e as IEmitEvent)
        )
        .subscribe(async (emitEvent) => {
          const newIds = await getScenesIds();
          const oldIds = scenesList$.getValue();
          if (newIds !== oldIds) {
            scenesList$.next(newIds);
            emitEvent(EVENTS.SCENE_CHANGE, await this.listAll());
          }
        });
    }
  }

  async getByIndex(index: SceneIndex): Promise<SceneInfo> {
    const xmlString = await this.internal.exec(
      'AppGetPropertyAsync',
      `sceneconfig:${index}`
    );
    const result = parser.parse(xmlString, {
      attributeNamePrefix: '',
      ignoreAttributes: false,
    });
    const { placement } = result;

    return { index, id: placement.id, name: placement.name };
  }

  async getById(id: SceneId): Promise<SceneInfo> {
    const arrayOfScenes = await this.listAll();

    return (
      arrayOfScenes.find((scene) => scene.id === id) ||
      Promise.reject(`Scene with id: ${id} not found`)
    );
  }

  async getActive(): Promise<SceneInfo> {
    const splitMode = await isSplitMode(this.internal);

    if (splitMode) {
      const id = decodeURIComponent(
        await this.internal.exec('AppGetPropertyAsync', 'sceneid:i12')
      );

      return this.getById(id);
    }

    const index = Number(
      await this.internal.exec('AppGetPropertyAsync', 'scene:0')
    );

    return this.getByIndex(index);
  }

  async setActive(indexOrId: SceneId | SceneIndex): Promise<boolean> {
    const splitMode = await isSplitMode(this.internal);

    if (splitMode) {
      await this.internal.exec(
        'AppSetPropertyAsync',
        'scene:1',
        String(indexOrId)
      );

      await this.internal.exec('CallHostFunc', 'goLive');
      return true;
    }

    await this.internal.exec(
      'AppSetPropertyAsync',
      'scene:0',
      String(indexOrId)
    );
    return true;
  }

  async setName(id: SceneId, name: string): Promise<boolean> {
    await this.internal.exec('AppSetPropertyAsync', `scenename:${id}`, name);
    return true;
  }

  async listAll(): Promise<SceneInfo[]> {
    const xmlString = await this.internal.exec(
      'AppGetPropertyAsync',
      'sceneconfig'
    );
    const result = parser.parse(xmlString, {
      attributeNamePrefix: '',
      ignoreAttributes: false,
    });

    const {
      configuration: { placement },
    } = result;

    if (Array.isArray(placement)) {
      // We get all ids
      return placement.map((item: Placement, index: number) => {
        return { id: item.id, index, name: item.name };
      });
    } else if (typeof placement === 'object') {
      return [{ id: placement.id, index: 0, name: placement.name }];
    }

    return [];
  }

  async getItems(id: SceneId): Promise<Item[]> {
    const xmlString = await this.internal.exec(
      'AppGetPropertyAsync',
      `sceneconfig:${id}`
    );

    const sceneObject = parser.parse(xmlString, {
      attributeNamePrefix: '',
      ignoreAttributes: false,
    });
    const items = Array.isArray(sceneObject.placement.item)
      ? sceneObject.placement.item
      : [sceneObject.placement.item];

    return items.map(({ id, srcid, name }: Item) => ({
      id,
      srcid,
      name: unescape(name),
    }));
  }

  async eventHandler(eventName: string, args: any[], emitEvent: IEmitEvent) {
    switch (eventName) {
      case EVENTS.SCENE_ADD:
        (async () => {
          const [, stringUrl] = args as string[];
          const params = new URLSearchParams(stringUrl);

          const scene = params.get('scene');

          if (scene !== I12) {
            emitEvent(eventName, await this.getByIndex(Number(scene)));
          }

          if ([USER, INTERNAL].includes(params.get('type'))) {
            scenesListChange$.next(emitEvent);
          }
        })();
        break;
      case EVENTS.SCENE_DELETE:
        (async () => {
          const [, stringUrl] = args as string[];
          const params = new URLSearchParams(stringUrl);

          const type = params.get('type');

          const scene = params.get('scene');

          if (scene !== I12) {
            emitEvent(eventName, await this.getByIndex(Number(scene)));
          }

          if (type === USER) {
            scenesListChange$.next(emitEvent);
          }
        })();
        break;
      case EVENTS.SPLIT_MODE_GET:
        getSplitModeActiveScene = true;
        break;
      case EVENTS.SCENE_CHANGE:
        const [, sceneIndex] = args as number[];

        if (sceneIndex < 0) {
          return;
        }

        const splitMode = await isSplitMode(this.internal);

        if (splitMode) {
          if (getSplitModeActiveScene) {
            emitEvent(eventName, await this.getActive());
          }
          getSplitModeActiveScene = false;
          return;
        }

        emitEvent(eventName, await this.getActive());
        break;
      case EVENTS.SCENE_DELETE_ALL:
        emitEvent(eventName, '');

        scenesListChange$.next(emitEvent);
      default:
        return false;
    }
  }
}

export default Scene;
