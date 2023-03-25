import {BufferGeometry, Line, LineBasicMaterial, Vector3} from "three";
import {Text} from "troika-three-text";

/**
 * Represents a angle measurement between three points.
 */
export class Angle extends Line
{
	constructor(point)
	{
		if (!point)
		{
			point = new Vector3(0, 0, 0);
		}

		var geometry = new BufferGeometry().setFromPoints([point, point, point]);

		super(geometry, new LineBasicMaterial(
			{
				color: 0xffffff,
				linewidth: 5
			}));

		/**
		 * List of points that compose the measurement.
		 */
		this.points = [point.clone()];

		/**
		 * Text used to display the measurement value.
		 */
		this.text = new Text();
		this.text.fontSize = 0.1;
		this.text.color = 0xFFFFFF;
		this.text.anchorX = "center";
		this.text.anchorY = "middle";
		this.text.rotation.set(Math.PI, Math.PI, Math.PI);
		this.add(this.text);
	}

	/**
	 * Update the second measurement line with new position.
	 *
	 * Useful for preview in real time the measurement.
	 *
	 * @param {*} matrix
	 */
	setPointFromMatrix(matrix)
	{
		var position = new Vector3(matrix.elements[12], matrix.elements[13], matrix.elements[14]);
		this.points[this.points.length - 1].copy(position);

		this.updateGeometry();
		this.updateText();
	}

	/**
	 * Update the line geometry of the measurement to match the measurements array.
	 *
	 * Also recalculates the bouding sphere of the geometry to ensure proper camera culling.
	 */
	updateGeometry()
	{
		var positions = this.geometry.attributes.position.array;
		positions[0] = this.points[0].x;
		positions[1] = this.points[0].y;
		positions[2] = this.points[0].z;

		var a = this.points.length > 1 ? 1 : 0;
		positions[3] = this.points[a].x;
		positions[4] = this.points[a].y;
		positions[5] = this.points[a].z;

		var b = this.points.length > 2 ? 2 : a;
		positions[6] = this.points[b].x;
		positions[7] = this.points[b].y;
		positions[8] = this.points[b].z;

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.computeBoundingSphere();
	}

	/**
	 * Update the label text and position.
	 */
	getAngle()
	{
		if (this.points.length < 3)
		{
			return 0;
		}

		var a = this.points[0];
		var b = this.points[1];
		var c = this.points[2];

		const v1 = new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
		const v2 = new Vector3(c.x - b.x, c.y - b.y, c.z - b.z);

		const v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
		const v1norm = new Vector3(v1.x / v1mag, v1.y / v1mag, v1.z / v1mag);

		const v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
		const v2norm = new Vector3(v2.x / v2mag, v2.y / v2mag, v2.z / v2mag);

		const res = v1norm.x * v2norm.x + v1norm.y * v2norm.y + v1norm.z * v2norm.z;

		let angle = Math.acos(res);
		angle *= 180 / Math.PI;

		return angle;
	}

	/**
	 * Update the text of the measurement.
	 */
	updateText()
	{
		if (this.points.length < 3)
		{
			this.text.visible = false;
			return;
		}

		var center = new Vector3();
		for (var i = 0; i < this.points.length; i++)
		{
			center.add(this.points[i]);
		}
		center.divideScalar(this.points.length);

		this.text.visible = true;
		this.text.position.copy(center);
		this.text.position.y += 0.1;
		this.text.text = this.getAngle() + " deg";
		this.text.sync();
	}
}
