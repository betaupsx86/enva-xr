import { Group, Matrix4 } from "three";
import { ARObject } from "./ARObject.ts";
import { ARRenderer } from "ARRenderer.ts";

/**
 * Group of objects attached to image tracking.
 * 
 * Must have config.imageTracking enabled 
 */
export class ImageTracking extends Group implements ARObject {

    /**
     * Index of the tracker image to associate with this group.
     */
    public index: number = 0;

    public isARObject: boolean = true;

    constructor(index: number) {
        super();

        this.index = index;
    }
    
    /**
     * Update the group position based on tracking information.
     */
    public beforeARUpdate(renderer: ARRenderer, time: number, frame: XRFrame) {
        if (!renderer.config.imageTracking) {
            throw new Error("Renderer configuration must have 'imageTracking' enabled.");
        }
        
        if (this.index > renderer.config.imageTracking.length) {
            throw new Error("Image tracking target not available check the index of tracker group.");
        }

        // @ts-ignore
        const results: any[] = frame.getImageTrackingResults();

        for (const result of results) {
            // The result's index is the image's position in the trackedImages array specified at session creation
            const imageIndex = result.index;
            
            if (imageIndex === this.index)
            {
                // Get the pose of the image relative to a reference space.
                const pose = frame.getPose(result.imageSpace, renderer.xrReferenceSpace);
                
                // TODO <ADD CODE TO SET THE TRANFORMS>
                const matrix = new Matrix4();
				matrix.fromArray(pose.transform.matrix);

				this.position.setFromMatrixPosition(matrix);
            }
        }
    }

}