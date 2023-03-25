import {
	Vector3, Vector2, Mesh, WebGLRenderer, Scene, PerspectiveCamera,
	DirectionalLight, AmbientLightProbe,
	MeshBasicMaterial, MeshDepthMaterial, PlaneBufferGeometry,
	ShadowMaterial, BasicShadowMap, PCFShadowMap, PCFSoftShadowMap, VSMShadowMap, AmbientLight
} from "three";
import {World, NaiveBroadphase, SplitSolver, GSSolver, Body, Plane, Vec3} from "cannon-es";
import cannonDebugger from 'cannon-es-debugger';
import {XRManager} from "./utils/XRManager";
import {Cursor} from "./object/Cursor";
import {DepthCanvasTexture} from "./texture/DepthCanvasTexture";
import {DepthDataTexture} from "./texture/DepthDataTexture";
import {PerformanceMeter} from "./utils/PerformanceMeter";
import {AugmentedMaterial} from "./material/AugmentedMaterial";

export class ARApp
{
	constructor()
	{
		/**
		 * Light probe used to acess the lighting estimation for the this.scene.
		 */
		this.xrLightProbe = null;

		/**
		 * Physics this.world used for interaction.
		 */
		this.world = null;

		/**
		 * Voxel environment use
		 */
		this.voxelEnvironment = null; // new VoxelEnvironment();

		/**
		 * Phsyics floor plane should be set to the lowest plane intersection found.
		 */
		this.floor = null;

		/**
		 * If true the depth data is shown.
		 */
		this.debugDepth = false;

		/**
		 * XR Viewer pose object.
		 */
		this.pose = null;

		/**
		 * Canvas to draw depth information for debug.
		 */
		this.depthCanvas = null;

		/**
		 * Depth canvas texture with the calculated depth used to debug.
		 */
		this.depthTexture = null;

		/**
		 * Depth data texture.
		 */
		this.depthDataTexture = null;

		/**
		 * Camera used to view the this.scene.
		 */
		this.camera = new PerspectiveCamera(60, 1, 0.1, 10);

		/**
		 * Scene to draw into the screen.
		 */
		this.scene = new Scene();

		/**
		 * Directional shadow casting light.
		 */
		this.directionalLight = null;

		/**
		 * Light probe object using spherical harmonics.
		 */
		this.lightProbe = null;

		/**
		 * Mesh used as floor.
		 */
		this.shadowMaterial = null;

		/**
		 * Ambient light.
		 */
		this.ambientLight = null;

		/**
		 * Mesh used to cast shadows into the floor.
		 */
		this.floorMesh = null;

		/**
		 * Time of the last frame.
		 */
		this.lastTime = 0;

		/**
		 * WebGL this.renderer used to draw the this.scene.
		 */
		this.renderer = null;

		/**
		 * WebXR hit test source, (null until requested).
		 */
		this.xrHitTestSource = null;

		/**
		 * Indicates if a hit test source was requested.
		 */
		this.hitTestSourceRequested = false;

		/**
		 * Cursor to hit test the this.scene.
		 */
		this.cursor = new Cursor();

		/**
		 * Measurement being created currently.
		 */
		this.measurement = null;

		/**
		 * Size of the this.rendererer.
		 */
		this.resolution = new Vector2();

		/**
		 * WebGL 2.0 context used to render.
		 */
		this.glContext = null;

		/**
		 * XRWebGLBinding object used get additional gl data.
		 */
		this.xrGlBinding = null;

		/**
		 * Callback to update logic of the app before rendering.
		 */
		this.onFrame = null;

		/**
		 * Rendering canvas.
		 */
		this.canvas = null;

		/**
		 * Rendering mode in use.
		 */
		this.mode = ARApp.NORMAL;

		/**
		 * DOM container for GUI elements visible in AR mode.
		 */
		this.domContainer = document.createElement("div");
		this.domContainer.style.position = "absolute";
		this.domContainer.style.top = "0px";
		this.domContainer.style.left = "0px";
		this.domContainer.style.width = "100%";
		this.domContainer.style.height = "100%";
	}


	/**
	 * Initalize the AR app.
	 */
	initialize()
	{
		this.createScene();
		// this.createWorld();

		this.resolution.set(window.innerWidth, window.innerHeight);

		document.body.appendChild(this.domContainer);

		this.resetDepthCanvas();
		this.createRenderer();
		this.setRenderMode(ARApp.NORMAL);

		// Cursor to select objects
		this.scene.add(this.cursor);

		// Resize this.renderer
		window.addEventListener("resize", () => {this.resize();}, false);

		this.start();
	}

	/**
	 * Start the XR mode.
	 */
	start() 
	{
		XRManager.start(this.renderer,
			{
				optionalFeatures: ["dom-overlay"],
				domOverlay: {root: this.domContainer},
				requiredFeatures: ["depth-sensing", "hit-test", "light-estimation"],
				depthSensing: {
					usagePreference: ["cpu-optimized", "gpu-optimized"],
					dataFormatPreference: ["luminance-alpha", "float32"]
				}
			}, function(error)
			{
				alert("Error starting the AR session. " + error);
			});

		// Render loop
		this.renderer.setAnimationLoop((time, frame) =>
		{
			if (this.onFrame) 
			{
				this.onFrame(time, this);
			}
			
			this.render(time, frame);
		});
	}

	createScene()
	{
		this.depthDataTexture = new DepthDataTexture();

		this.ambientLight = new AmbientLight(0x333333);
		this.scene.add(this.ambientLight);

		this.directionalLight = new DirectionalLight();
		this.directionalLight.castShadow = true;
		this.directionalLight.shadow.mapSize.set(1024, 1024);
		this.directionalLight.shadow.camera.far = 20;
		this.directionalLight.shadow.camera.near = 0.1;
		this.directionalLight.shadow.camera.left = -5;
		this.directionalLight.shadow.camera.right = 5;
		this.directionalLight.shadow.camera.bottom = -5;
		this.directionalLight.shadow.camera.top = 5;
		this.scene.add(this.directionalLight);

		// this.lightProbe = new AmbientLightProbe();
		// this.scene.add(this.lightProbe);

		// this.shadowMaterial = new ShadowMaterial({opacity: 0.5});
		// this.shadowMaterial = AugmentedMaterial.transform(this.shadowMaterial, this.depthDataTexture);

		// this.floorMesh = new Mesh(new PlaneBufferGeometry(100, 100, 1, 1), this.shadowMaterial);
		// this.floorMesh.rotation.set(-Math.PI / 2, 0, 0);
		// this.floorMesh.castShadow = false;
		// this.floorMesh.receiveShadow = true;
		// this.scene.add(this.floorMesh);
	}

	/**
	 * Chnage the random rendering method.
	 */
	setShadowType()
	{
		if (!this.renderer.shadowMap.enabled)
		{
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = BasicShadowMap;
		}
		else if (this.renderer.shadowMap.type === BasicShadowMap)
		{
			this.renderer.shadowMap.type = PCFShadowMap;
		}
		else if (this.renderer.shadowMap.type === PCFShadowMap)
		{
			this.renderer.shadowMap.type = PCFSoftShadowMap;
		}
		else if (this.renderer.shadowMap.type === PCFSoftShadowMap)
		{
			this.renderer.shadowMap.type = VSMShadowMap;
		}
		else if (this.renderer.shadowMap.type === VSMShadowMap)
		{
			this.renderer.shadowMap.enabled = false;
			this.renderer.shadowMap.type = BasicShadowMap;
		}

		this.renderer.shadowMap.needsUpdate = true;
		this.scene.traverse(function(child)
		{
			if (child.material)
			{
				child.material.needsUpdate = true;
			}
		});

		console.log("enva-xr: Shadow type changed to " + this.renderer.shadowMap.type);
	}

	/**
	 * Switch the render mode being used by the framework
	 * 
	 * @param mode - Render mode to be used (optional, is missing sets next render mode)
	 */
	setRenderMode(mode = null)
	{
		this.mode++;

		if (mode !== null) 
		{
			this.mode = mode;
		}

		if (this.mode === ARApp.DEBUG_CAMERA_IMAGE)
		{
			this.mode = ARApp.NORMAL;
		}

		if (this.mode === ARApp.NORMAL)
		{
			this.scene.overrideMaterial = null;
			this.scene.traverse(function(child)
			{
				if (child.isMesh && child.material && child.material.isAgumentedMaterial)
				{
					child.material.userData.uOcclusionEnabled.value = true;
					child.material.uniformsNeedUpdate = true;
				}
			});
		}
		else if (this.mode === ARApp.DEBUG_ZBUFFER)
		{
			this.scene.overrideMaterial = new MeshDepthMaterial();
		}
		else if (this.mode === ARApp.DEBUG_AR_DEPTH)
		{
			this.scene.overrideMaterial = null;
			this.debugDepth = true;
			this.depthCanvas.style.width = "100%";
			this.depthCanvas.style.height = "100%";
			this.depthCanvas.style.right = "0px";
			this.depthCanvas.style.bottom = "0px";
			this.depthCanvas.style.borderRadius = "0px";
		}
		else if (this.mode === ARApp.DEBUG_NO_OCCLUSION)
		{
			this.resetDepthCanvas();
			this.scene.overrideMaterial = null;
			this.scene.traverse(function(child)
			{
				if (child.isMesh && child.material && child.material.isAgumentedMaterial)
				{
					child.material.userData.uOcclusionEnabled.value = false;
					child.material.uniformsNeedUpdate = true;
				}
			});
		}
		else if (this.mode === ARApp.DEBUG_CAMERA_IMAGE)
		{
			this.scene.overrideMaterial = new MeshBasicMaterial({transparent: true, opacity: 0.0});
		}
	}

	/**
	 * Create and setup webgl this.renderer object.
	 *
	 * @param {*} canvas
	 */
	createRenderer()
	{
		this.canvas = document.createElement("canvas");
		document.body.appendChild(this.canvas);

		this.glContext = this.canvas.getContext("webgl2", {xrCompatible: true});

		this.renderer = new WebGLRenderer(
			{
				context: this.glContext,
				antialias: true,
				alpha: true,
				canvas: this.canvas,
				depth: true,
				powerPreference: "high-performance",
				precision: "highp",
				preserveDrawingBuffer: false,
				premultipliedAlpha: true,
				logarithmicDepthBuffer: false,
				stencil: true
			});

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = PCFSoftShadowMap;
		this.renderer.sortObjects = false;
		this.renderer.physicallyCorrectLights = true;

		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.xr.enabled = true;
	}

	forceContextLoss()
	{
		try
		{
			if (this.renderer !== null)
			{
				this.renderer.dispose();
				this.renderer.forceContextLoss();
				this.renderer = null;
			}
		}
		catch (e)
		{
			this.renderer = null;
			throw new Error("Failed to destroy WebGL context.");
		}

		if (this.canvas !== null)
		{
			document.body.removeChild(this.canvas);
		}
	};


	/**
	 * Create physics this.world for collistion simulation.
	 */
	createWorld()
	{
		this.world = new World();
		this.world.gravity.set(0, -9.8, 0);
		this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
		this.world.defaultContactMaterial.contactEquationRelaxation = 4;
		this.world.quatNormalizeSkip = 0;
		this.world.quatNormalizeFast = false;

		this.world.broadphase = new NaiveBroadphase();
		this.world.broadphase.useBoundingBoxes = true;

		let solver = new GSSolver();
		solver.tolerance = 0.1;
		solver.iterations = 7;
		this.world.solver = new SplitSolver(solver);

		this.floor = new Body();
		this.floor.type = Body.STATIC;
		this.floor.position.set(0, 0, 0);
		this.floor.velocity.set(0, 0, 0);
		this.floor.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2);
		this.floor.addShape(new Plane());
		this.world.addBody(this.floor);
	}

	/**
	 * Enable the physics debugger.
	 *
	 * Cannot be disabled after its enabled.
	 */
	enablePhysicsDebugger()
	{
		cannonDebugger(this.scene, this.world.bodies, {
			color: 0x00ff00,
			autoUpdate: true
		});
	}

	/**
	 * Reset the depth debug canvas.
	 */
	resetDepthCanvas()
	{
		if (!this.depthCanvas)
		{
			this.depthCanvas = document.createElement("canvas");
			this.domContainer.appendChild(this.depthCanvas);
			this.depthTexture = new DepthCanvasTexture(this.depthCanvas);
		}

		this.depthCanvas.style.position = "absolute";
		this.depthCanvas.style.right = "10px";
		this.depthCanvas.style.bottom = "10px";
		this.depthCanvas.style.borderRadius = "20px";
		this.depthCanvas.style.width = "180px";
		this.depthCanvas.style.height = "320px";
	}

	/**
	 * Resize the canvas and this.renderer size.
	 */
	resize()
	{
		this.resolution.set(window.innerWidth, window.innerHeight);

		this.camera.aspect = this.resolution.x / this.resolution.y;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize(this.resolution.x, this.resolution.y);
		this.renderer.setPixelRatio(window.devicePixelRatio);
	}


	/**
	 * Update logic and render this.scene into the screen.
	 *
	 * @param {*} time
	 * @param {*} frame
	 */
	render(time, frame)
	{
		if (!frame)
		{
			return;
		}

		// Update physics this.world
		// let delta = time - this.lastTime;
		// this.lastTime = time;
		// this.world.step(delta / 1e3);

		let session = this.renderer.xr.getSession();
		let referenceSpace = this.renderer.xr.getReferenceSpace();

		if (!this.xrGlBinding)
		{
			this.xrGlBinding = new XRWebGLBinding(session, this.glContext);
		}

		// Request hit test source
		if (!this.hitTestSourceRequested)
		{
			session.requestReferenceSpace("viewer").then((referenceSpace) =>
			{
				session.requestHitTestSource({space: referenceSpace}).then((source) =>
				{
					this.xrHitTestSource = source;
				});
			});

			// session.requestLightProbe().then((probe) =>
			// {
			// 	this.xrLightProbe = probe;

			// 	// Get cube map for reflections
			// 	/* this.xrLightProbe.addEventListener("reflectionchange", () => {
			// 		let glCubeMap = this.xrGlBinding.getReflectionCubeMap(this.xrLightProbe);
			// 		console.log(glCubeMap);
			// 	}); */
			// });

			session.addEventListener("end", () =>
			{
				this.hitTestSourceRequested = false;
				this.xrHitTestSource = null;
			});

			this.hitTestSourceRequested = true;
		}


		// Process lighting condition from probe
		// if (this.xrLightProbe)
		// {
		// 	let lightEstimate = frame.getLightEstimate(this.xrLightProbe);
		// 	if (lightEstimate)
		// 	{
		// 		let directionalPosition = new Vector3(lightEstimate.primaryLightDirection.x, lightEstimate.primaryLightDirection.y, lightEstimate.primaryLightDirection.z);
		// 		directionalPosition.multiplyScalar(5);

		// 		let intensity = Math.max(1.0, Math.max(lightEstimate.primaryLightIntensity.x, Math.max(lightEstimate.primaryLightIntensity.y, lightEstimate.primaryLightIntensity.z)));
		// 		this.directionalLight.position.copy(directionalPosition);
		// 		this.directionalLight.color.setRGB(lightEstimate.primaryLightIntensity.x / intensity, lightEstimate.primaryLightIntensity.y / intensity, lightEstimate.primaryLightIntensity.z / intensity);
		// 		this.directionalLight.intensity = intensity;

		// 		this.lightProbe.sh.fromArray(lightEstimate.sphericalHarmonicsCoefficients);
		// 	}
		// }

		// Process Hit test
		if (this.xrHitTestSource)
		{
			let hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
			if (hitTestResults.length)
			{
				let hit = hitTestResults[0];
				
				this.cursor.visible = true;
				this.cursor.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

				// // Update physics floor plane
				// let position = new Vector3();
				// position.setFromMatrixPosition(this.cursor.matrix);
				// if (position.y < this.floor.position.y)
				// {
				// 	this.floor.position.y = position.y;
				// }

				// // Shadow plane
				// this.floorMesh.position.y = position.y;
			}
			else
			{
				this.cursor.visible = false;
			}

			if (this.measurement)
			{
				this.measurement.setPointFromMatrix(this.cursor.matrix);
			}
		}

		// Handle depth
		// let viewerPose = frame.getViewerPose(referenceSpace);
		// if (viewerPose)
		// {
		// 	this.pose = viewerPose;
		// 	for (let view of this.pose.views)
		// 	{
		// 		let depthInfo = frame.getDepthInformation(view);
		// 		if (depthInfo)
		// 		{
		// 			// Voxel environment
		// 			// this.voxelEnvironment.update(this.camera, depthData);

		// 			// Update textures
		// 			this.depthDataTexture.updateDepth(depthInfo);

		// 			// Draw canvas texture depth
		// 			if (this.debugDepth)
		// 			{
		// 				this.depthTexture.updateDepth(depthInfo, this.camera.near, this.camera.far);
		// 			}

		// 			// Update normal matrix
		// 			AugmentedMaterial.updateUniforms(this.scene, depthInfo);
		// 		}
		// 	}
		// }

		this.renderer.render(this.scene, this.camera);
		// this.timeMeterFrame.tock();

		// if (this.timeMeter.finished() && this.timeMeterFrame.finished())
		// {
		// 	let a = this.timeMeter.stats();
		// 	this.timeMeter.reset(false);

		// 	let b = this.timeMeterFrame.stats();
		// 	this.timeMeterFrame.reset(false);
			
		// 	// Log performance metrics
		// 	console.log(`${c++};${a.average};${a.max};${a.min};${b.average};${b.max};${b.min}`);
		// }
	}
}
