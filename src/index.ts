export { default, XjsTypes } from './core/xjs';
export { default as Scene } from './core/scene';
export { default as Event } from './core/event';
export { default as View } from './core/view';

// @TODO: We might want to just do this for the UMD version, to minimize the final
// bundle size of the **users** app. That way, we'll allow them to only import and bundle
// specific parts of XJS.
// export { default as Scene } from './core/scene';
// export { default as Item } from './core/item';
// export { default as ItemProps } from './props/item-props';
// export { default as AppProps } from './props/app-props';
