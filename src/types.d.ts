export type XRWebGLBinding = any;

export type XRLightProbe = any;

export type XRDepthInformation = any;

export type XRRigidTransform = any;

export type XRCPUDepthInformation = {
	data: ArrayBuffer,
	width: number,
	height: number,
	normDepthBufferFromNormView: XRRigidTransform,
	rawValueToMeters: number
	getDepthInMeters: (x: number, y: number) => number,
};

export type XRGPUDepthInformation = any;
export type XRWebGLDepthInformation = any;
