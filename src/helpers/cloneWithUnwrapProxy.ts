import createRfdc from "rfdc";

const rfdc = createRfdc();

/** Proxyを展開してクローンする。*/
export const cloneWithUnwrapProxy = <T>(obj: T): T => rfdc(obj);
