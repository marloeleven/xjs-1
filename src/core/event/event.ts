import Xjs, { XjsTypes } from 'core/xjs';
import registerCallback from 'helpers/register-callback';
import { IInstances, IFunctionVoid } from './types';

import isFunction from 'lodash/isFunction';
import { values } from 'lodash-es';

const eventCallbacks = {};

function parseSegments(segments: string[]): any {
  const parsed = segments.reduce((obj, current) => {
    const [key, value] = String(current).split('=');

    return { ...obj, [key]: decodeURIComponent(value) };
  }, {});

  return parsed;
}

export default class Events {
  private xjs: Xjs;

  constructor({ xjs, ...instances }) {
    this.xjs = xjs;

    registerCallback({
      // SetEvent(value: string) {
      //   const segments = String(value).split('&');
      //   const { event, info } = parseSegments(segments);

      //   if (Array.isArray(eventCallbacks[event])) {
      //     eventCallbacks[event].forEach(callback => {
      //       if (typeof callback === 'function') {
      //         callback(decodeURIComponent(info));
      //       }
      //     });
      //   }
      // },
      OnEvent: (event: string, sourceId: string, property: string) => {
        // Triggered only when `ItemSubscribeEvents` method is called
      },
      AppOnEvent: async (eventName: string, ...args: any) => {
        // const data = await Object.values(instances as IInstances).reduce(
        //   async (val, instance) => {
        //     if (isFunction(instance)) {
        //       return await instance.eventHandler(eventName, args);
        //     }

        //     return val;
        //   },
        //   Promise.resolve(args)
        // );

        // this.emitEvent(eventName, data);

        Object.values(instances as IInstances).forEach((instance) => {
          if (
            instance.hasOwnProperty('eventHandler') &&
            isFunction(instance.eventHandler)
          ) {
            instance.eventHandler(eventName, args, this.emitEvent);
          }
        });
      },
    });
  }

  hasSubscription(eventName: string): Boolean {
    return eventCallbacks.hasOwnProperty(eventName);
  }

  emitEvent(eventName: string, result: string) {
    if (this.hasSubscription(eventName)) {
      eventCallbacks[eventName](result);
    }

    if (this.xjs.remote && this.xjs.isProxy()) {
      this.xjs.remote.proxy.emitEvent(eventName, result);
    }
  }

  on(eventName: string, callback: IFunctionVoid) {
    if (this.xjs.isRemote()) {
      this.xjs.remote.remote.registerEvent(eventName, callback);
      return;
    }
    eventCallbacks[eventName] = callback;
  }

  off(eventName: string) {
    if (this.xjs.isRemote()) {
      this.xjs.remote.remote.unregisterEvent(eventName);
      return;
    }

    if (this.hasSubscription(eventName)) {
      delete eventCallbacks[eventName];
    }
  }
}
