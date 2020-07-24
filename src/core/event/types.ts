export type EventMetaDataType = {
  key: string;
  environmentValidator: () => boolean;
};

export type IFunctionVoid = (...args: unknown[]) => void;

export interface IInstances {
  [instance: string]: {
    eventHandler: (
      event: string,
      args: string[],
      emitEvent: IEmitEvent
    ) => void;
  };
}

export type IEmitEvent = (eventName: string, result: any) => void;
