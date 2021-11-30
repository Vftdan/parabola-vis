var app = null;

addEventListener('load', function() {
	var CANVAS_SIZE = 1080;
	app = {
		algebra: {  // matrices look transposed in code, we index column, then row
			matMul: function(a, b, c) {
				if (c == undefined)
					c = [];
				for (; c.length < b.length;)
					c.push([]);
				if (a.length == 0)
					return c;
				for (var i = 0; i < b.length; ++i)
					for (var j = 0; j < a[0].length; ++j) {
						var s = 0;
						for (var k = 0; k < a.length; ++k)
							s += a[k][j] * b[i][k];
						c[i][j] = s;
					}
				return c;
			},
			matInv2d: function(a, b) {
				if (b == undefined)
					b = [];
				var invDet = 1 / (a[0][0] * a[1][1] - a[1][0] * a[0][1]);
				for (var i = 0; i < 2; ++i) {
					if (b[i] == undefined)
						b[i] = [];
					for (var j = 0; j < 2; ++j) {
						b[i][j] = ((i + j) & 1 ? -1 : 1) *
							a[1 - j][1 - i] * invDet;
					}
				}
				return b;
			},
			vecAdd: function(a, b, c) {
				if (c == undefined)
					c = [];
				var length = Math.min(a.length, b.length);
				for (var i = 0; i < length; ++i)
					c[i] = a[i] + b[i];
				return c;
			},
			vecSub: function(a, b, c) {
				if (c == undefined)
					c = [];
				var length = Math.min(a.length, b.length);
				for (var i = 0; i < length; ++i)
					c[i] = a[i] - b[i];
				return c;
			},
		},
		camera: {
			origin: [0, 0],
			projectionMatrix: [
				[0.05,  0],  // world x
				[0, -0.05],  // world y
			],
			_unprojectionMatrix: null,
			getUnprojectionMatrix: function(invalidate) {
				if (invalidate || this._unprojectionMatrix == null)
					this._unprojectionMatrix = app.algebra.matInv2d(this.projectionMatrix, this._unprojectionMatrix);
				return this._unprojectionMatrix;
			},
			project: function(pos, result) {
				if (result == undefined)
					result = [0, 0];
				return app.algebra.vecAdd(app.algebra.matMul(this.projectionMatrix, [app.algebra.vecSub(pos, this.origin)], [result])[0], [0.5, 0.5], result);
			},
			unproject: function(pos, result) {
				if (result == undefined)
					result = [0, 0];
				return app.algebra.vecAdd(app.algebra.matMul(this.getUnprojectionMatrix(), [app.algebra.vecSub(pos, [0.5, 0.5])], [result])[0], this.origin, result);
			},
			getSceneBounds: function(topLeft, bottomRight) {  // primarily for clipping
				var p1 = this.unproject(topLeft),
				    p2 = this.unproject(bottomRight);
				return [
					[Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1])],
					[Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])],
				];
			},
		},
		canvas: document.createElement('canvas'),
		controlsForm: document.getElementById('controls'),
		drawing: {
			ctx: null,
			width: CANVAS_SIZE,
			height: CANVAS_SIZE,
			style: {
				lineWidth: 2,
				bgColor: [255, 255, 255, 1],
				pointColor: [0, 0, 0, 1],
				plotColor: [0, 0, 255, 1],
				axisColor: [0, 150, 50, 1],
				gridColor: [120, 120, 120, 1],
				gridCoordinateColor: [0, 50, 0, 1],
				font: '24px sans-serif',
			},
			project: function(pos, result) {
				result = app.camera.project(pos, result);
				result[0] *= this.width;
				result[1] *= this.height;
				return result;
			},
			unproject: function(pos, result) {
				result = app.camera.unproject([pos[0] / this.width, pos[1] / this.height], result);
				return result;
			},
			_projectFn: function(pos, result) {
				return app.drawing.project(pos, result);
			},
			drawElement: function(elem, bounds, resolution) {
				if (bounds == undefined)
					bounds = app.camera.getSceneBounds([0, 0], [1, 1]);
				if (resolution == undefined)
					resolution = Math.min(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]) /
					             Math.max(this.width, this.height);
				elem.drawAt(this.ctx, this._projectFn, bounds, resolution, this.style);
			},
			drawScene: function() {
				this.ctx.clearRect(0, 0, this.width, this.height);
				this.ctx.fillStyle = 'rgba(' + this.style.bgColor + ')';
				this.ctx.fillRect(0, 0, this.width, this.height);
				var bounds = app.camera.getSceneBounds([0, 0], [1, 1]);
				var resolution = Math.min(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]) /
				                 Math.max(this.width, this.height);  // approximate scene units per pixel
				var elements = app.scene.getElements();
				for (var i = 0; i < elements.length; ++i) {
					this.drawElement(elements[i], bounds, resolution);
				}
			},
		},
		shapes: (function() {
			var Point = function(x, y) {
				this.pos = [x, y];
			};
			Point.prototype = {
				drawAt: function(ctx, projectFn, bounds, resolution, style) {
					ctx.fillStyle = 'rgba(' + style.pointColor + ')';
					ctx.beginPath();
					var pos = projectFn(this.pos);
					var r = style.lineWidth * 2.5;
					ctx.ellipse(pos[0], pos[1], r, r, 0, 0, 6.29);
					ctx.fill();
				}
			};

			var Parabola = function(a, b, c) {
				this.a = a;
				this.b = b;
				this.c = c;
			};
			Parabola.prototype = {
				drawAt: function(ctx, projectFn, bounds, resolution, style) {
					ctx.strokeStyle = 'rgba(' + style.plotColor + ')';
					ctx.lineWidth = style.lineWidth;
					ctx.beginPath();
					var pos = [bounds[0][0] - resolution * 10, this.func(bounds[0][0])];
					var ctxPos = [0, 0];
					projectFn(pos, ctxPos);
					ctx.moveTo(ctxPos[0], ctxPos[1]);
					while (pos[0] <= bounds[1][0]) {
						pos[0] += resolution;
						pos[1] = this.func(pos[0]);
						if (pos[1] >= bounds[0][1] - resolution * 10 &&
						    pos[1] <= bounds[1][1] + resolution * 10) {
							projectFn(pos, ctxPos);
							ctx.lineTo(ctxPos[0], ctxPos[1]);
						}
					}
					ctx.stroke();
				},
				func: function(x) {
					return this.a * x * x + this.b * x + this.c;
				}
			};

			var CoordinateGrid = function(cellSize) {
				this.cellSize = cellSize;
			};
			CoordinateGrid.prototype = {
				drawAt: function(ctx, projectFn, bounds, resolution, style) {
					ctx.strokeStyle = 'rgba(' + style.gridColor + ')';
					ctx.lineWidth = style.lineWidth / 2;
					ctx.beginPath();
					var firstPos = [];
					var cellSize = this.cellSize;
					for (var i = 0; i < 2; ++i) {
						var x = bounds[0][i];
						firstPos.push(Math.floor(x / cellSize) * cellSize);
					}
					var ctxPos = [0, 0];
					for (var i = 0; i < 2; ++i) {
						var pos1 = bounds[0].slice(0);
						var pos2 = bounds[1].slice(0);
						var curr = firstPos[i];
						while (curr <= bounds[1][i]) {
							pos1[i] = curr;
							pos2[i] = curr;
							projectFn(pos1, ctxPos);
							ctx.moveTo(ctxPos[0], ctxPos[1]);
							projectFn(pos2, ctxPos);
							ctx.lineTo(ctxPos[0], ctxPos[1]);
							curr += cellSize;
						}
					}
					ctx.stroke();

					ctx.beginPath();
					ctx.strokeStyle = 'rgba(' + style.axisColor + ')';
					ctx.lineWidth = style.lineWidth * 1.5;
					for (var i = 0; i < 2; ++i) {
						var pos1 = bounds[0].slice(0);
						var pos2 = bounds[1].slice(0);
						pos1[i] = 0;
						pos2[i] = 0;
						projectFn(pos1, ctxPos);
						ctx.moveTo(ctxPos[0], ctxPos[1]);
						projectFn(pos2, ctxPos);
						ctx.lineTo(ctxPos[0], ctxPos[1]);
					}
					ctx.stroke();

					ctx.fillStyle = 'rgba(' + style.gridCoordinateColor + ')';
					ctx.textAlign = 'right';
					ctx.textBaseline = 'top';
					ctx.font = style.font;
					var zero = [0, 0];
					for (var i = 0; i < 2; ++i) {
						if (zero[i] < bounds[0][i])
							zero[i] = bounds[0][i];
						if (zero[i] > bounds[1][i])
							zero[i] = bounds[1][i];
					}
					for (var i = 0; i < 2; ++i) {
						var curr = firstPos[i];
						var pos = zero.slice(0);
						while (curr <= bounds[1][i]) {
							pos[i] = curr;
							projectFn(pos, ctxPos);
							ctx.fillText(curr, ctxPos[0] - 0.05 / resolution, ctxPos[1] + 0.075 / resolution);
							curr += cellSize;
						}
					}
				}
			};

			return {
				Point: Point,
				Parabola: Parabola,
				CoordinateGrid: CoordinateGrid,
			};
		})(),
		scene: {
			_elements: [],
			getElements: function() {
				return this._elements;
			},
		},
		ui: {
			exposeVariables: function(vars, cb) {
				app.controlsForm.innerHTML = '';
				var inputs = [];
				app.controlsForm.onsubmit = function(e) {
					e.preventDefault();
					for (var i = 0; i < vars.length; ++i) {
						var v = vars[i];
						var value = inputs[i].value;
						if (v.validate && !v.validate(value)) {
							alert('Invalid ' + v.name + ' value');
							return;
						}
						v.value = value;
					}
					cb(vars);
				}
				for (var i = 0; i < vars.length; ++i) {
					var v = vars[i];
					var label = document.createElement('label');
					var span = document.createElement('span');
					var input = document.createElement('input');
					input.type = 'text';
					span.innerText = v.name + ' = ';
					input.value = v.value;
					label.appendChild(span);
					label.appendChild(input);
					inputs.push(input);
					app.controlsForm.appendChild(label);
				}
				var submit = document.createElement('input');
				submit.type = 'submit';
				submit.value = 'Redraw';
				app.controlsForm.appendChild(submit);
			},
			handleClick: function(e) {
				var pos = app.drawing.unproject(this.clientToCanvasCoords(e.clientX, e.clientY));
				app.model.handleClick(pos);
			},
			clientToCanvasCoords: function(x, y) {
				var r = app.canvas.getBoundingClientRect();
				var scale = app.canvas.width / r.width;
				return [(x - r.left) * scale, (y - r.top) * scale];
			},
			_clickHandler: function(e) {
				return app.ui.handleClick(e);
			}
		},
		model: {
			points: [],
			coefs: null,
			handleClick: function(pos) {
				if (this.points.length >= 3)
					return;
				this.points.push(pos);
				app.scene._elements.push(new app.shapes.Point(pos[0], pos[1]));
				if (this.points.length == 3) {
					var coefs = this.calculateCoefficients(this.points[0], this.points[1], pos);
					this.coefs = coefs;
					var parabola = new app.shapes.Parabola(coefs[0], coefs[1], coefs[2]);
					var updateParabola = function() {
						parabola.a = coefs[0];
						parabola.b = coefs[1];
						parabola.c = coefs[2];
						app.drawing.drawScene();
					};
					app.scene._elements.push(parabola);
					var validate = function(x) {
						x = +x;
						if (isNaN(x))
							return false;
						return true;
					};
					var vars = [
						{name: 'a', value: coefs[0], validate: validate},
						{name: 'b', value: coefs[1], validate: validate},
						{name: 'c', value: coefs[2], validate: validate},
					];
					var cb = function(vars) {
						for (var i = 0; i < 3; ++i)
							coefs[i] = +vars[i].value;
						updateParabola();
					};
					app.ui.exposeVariables(vars, cb);
				}
				app.drawing.drawScene();
			},
			calculateCoefficients: function(p1, p2, p3) {
				// source: <url:http://fdisto.misis.ru/s/Hel/Matem/Para_3t.htm>
				var a = (p3[1] - (p3[0] * (p2[1] - p1[1]) + p2[0] * p1[1] - p1[0] * p2[1]) / (p2[0] - p1[0])) /
				        (p3[0] * (p3[0] - p2[0] - p1[0]) + p1[0] * p2[0]);
				var b = (p2[1] - p1[1]) / (p2[0] - p1[0]) - a * (p1[0] + p2[0]);
				var c = (p2[0] * p1[1] - p1[0] * p2[1]) / (p2[0] - p1[0]) + a * p1[0] * p2[0];
				return [a, b, c];
			},
		},
	};

	app.canvas.width  = CANVAS_SIZE;
	app.canvas.height = CANVAS_SIZE;
	app.drawing.ctx = app.canvas.getContext('2d');
	document.getElementById('deploy').appendChild(app.canvas);
	app.canvas.addEventListener('click', app.ui._clickHandler, false);
	app.scene._elements.push(new app.shapes.CoordinateGrid(1));
	app.drawing.drawScene();
}, false);
