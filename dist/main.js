// src/core/message/messageSubscriptionNode.ts
class MessageSubscriptionNode {
  message;
  handler;
  constructor(message, handler) {
    this.message = message;
    this.handler = handler;
  }
}

// src/core/message/messageBus.ts
class MessageBus {
  static _subscription = {};
  static _normalQueueMessagePerUpdate = 10;
  static _normalMessageQueue = [];
  constructor() {
  }
  static addSubscription(code, handler) {
    if (MessageBus._subscription[code] === undefined) {
      MessageBus._subscription[code] = [];
    }
    if (MessageBus._subscription[code].indexOf(handler) !== -1) {
      console.warn("WARN: Attempting to add a duplicate handler to code: " + code + " . Subscription not added");
    } else {
      MessageBus._subscription[code].push(handler);
    }
  }
  static removeSubscription(code, handler) {
    if (MessageBus._subscription[code] === undefined) {
      console.warn("WARN: Cannot unsubscribe handler from code: " + code + " . Code is not subscribed to.");
      return;
    }
    let nodeIndex = MessageBus._subscription[code].indexOf(handler);
    if (nodeIndex !== -1) {
      MessageBus._subscription[code].splice(nodeIndex, 1);
    }
  }
  static post(message) {
    console.log("LOG: Message posted: ", message);
    let handlers = MessageBus._subscription[message.code];
    if (handlers === undefined) {
      return;
    }
    for (let h of handlers) {
      if (message.priority === 1 /* HIGH */) {
        h.onMessage(message);
      } else {
        MessageBus._normalMessageQueue.push(new MessageSubscriptionNode(message, h));
      }
    }
  }
  static update(time) {
    if (MessageBus._normalMessageQueue.length === 0) {
      return;
    }
    let messageLimit = Math.min(MessageBus._normalQueueMessagePerUpdate, MessageBus._normalMessageQueue.length);
    for (let i = 0;i < messageLimit; ++i) {
      let node = MessageBus._normalMessageQueue.shift();
      node?.handler.onMessage(node.message);
    }
  }
}

// src/core/message/message.ts
class Message2 {
  code = "";
  context;
  sender;
  priority = 0 /* NORMAL */;
  constructor(code, sender, context, priority = 0 /* NORMAL */) {
    this.code = code;
    this.sender = sender;
    this.context = context;
    this.priority = priority;
  }
  static send(code, sender, context) {
    MessageBus.post(new Message2(code, sender, context, 0 /* NORMAL */));
  }
  static sendPriority(code, sender, context) {
    MessageBus.post(new Message2(code, sender, context, 1 /* HIGH */));
  }
  static subscribe(code, handler) {
    MessageBus.addSubscription(code, handler);
  }
  static unsubscribe(code, handler) {
    MessageBus.removeSubscription(code, handler);
  }
}

// src/core/assets/imageAssetLoader.ts
class ImageAsset {
  name;
  data;
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }
  get width() {
    return this.data.width;
  }
  get height() {
    return this.data.height;
  }
}

class ImageAssetLoader {
  get supportedExtensions() {
    return ["png", "gif", "jpg"];
  }
  loadAsset(assetName) {
    let image = new Image;
    image.onload = this.onImageLoaded.bind(this, assetName, image);
    image.src = assetName;
  }
  onImageLoaded(assetName, image) {
    console.info(`LOG: onImageLoaded: assetName/image, ${assetName} ${image}`);
    let asset = new ImageAsset(assetName, image);
    AssetManager.onAssetLoaded(asset);
  }
}

// src/core/assets/jsonAssetLoader.ts
class JsonAsset {
  name;
  data;
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }
}

class JsonAssetLoader {
  get supportedExtensions() {
    return ["json"];
  }
  loadAsset(assetName) {
    let request = new XMLHttpRequest;
    request.open("GET", assetName);
    request.addEventListener("load", this.onJsonLoaded.bind(this, assetName, request));
    request.send();
  }
  onJsonLoaded(assetName, request) {
    console.info("LOG: onJSONLoaded: assetName/request", assetName, request);
    if (request.readyState === request.DONE) {
      const jsonData = JSON.parse(request.responseText);
      let asset = new JsonAsset(assetName, jsonData);
      AssetManager.onAssetLoaded(asset);
    }
  }
}

// src/core/assets/textAssetLoader.ts
class TextAsset {
  name;
  data;
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }
}

class TextAssetLoader {
  get supportedExtensions() {
    return ["txt"];
  }
  loadAsset(assetName) {
    let request = new XMLHttpRequest;
    request.open("GET", assetName);
    request.addEventListener("load", this.onTextLoaded.bind(this, assetName, request));
    request.send();
  }
  onTextLoaded(assetName, request) {
    console.info("LOG: onTextLoaded: assetName/request", assetName, request);
    if (request.readyState === request.DONE) {
      let asset = new TextAsset(assetName, request.responseText);
      AssetManager.onAssetLoaded(asset);
    }
  }
}

// src/core/assets/assetManager.ts
var MESSAGE_ASSET_LOADER_ASSET_LOADED = "MESSAGE_ASSET_LOADER_ASSET_LOADED::";

class AssetManager {
  static _loaders = [];
  static _loadAssets = {};
  constructor() {
  }
  static initialize() {
    AssetManager._loaders.push(new ImageAssetLoader);
    AssetManager._loaders.push(new JsonAssetLoader);
    AssetManager._loaders.push(new TextAssetLoader);
  }
  static registerLoader(loader) {
    AssetManager._loaders.push(loader);
  }
  static onAssetLoaded(asset) {
    AssetManager._loadAssets[asset.name] = asset;
    Message2.send(MESSAGE_ASSET_LOADER_ASSET_LOADED + asset.name, this, asset);
  }
  static loadAsset(assetName) {
    let extension = assetName.split(".").pop()?.toLowerCase();
    for (let l of AssetManager._loaders) {
      if (l.supportedExtensions.indexOf(extension) !== -1) {
        l.loadAsset(assetName);
        return;
      }
    }
    console.warn(`WARN: Unable to load asset with extension '${extension}'. There is no loader associated with it.`);
  }
  static isAssetLoaded(assetName) {
    return AssetManager._loadAssets[assetName] !== undefined;
  }
  static getAsset(assetName) {
    if (AssetManager._loadAssets[assetName] !== undefined) {
      return AssetManager._loadAssets[assetName];
    } else {
      AssetManager.loadAsset(assetName);
    }
    return;
  }
}

// src/core/math/vector3.ts
class Vector3 {
  _x;
  _y;
  _z;
  constructor(x = 0, y = 0, z = 0) {
    this._x = x;
    this._y = y;
    this._z = z;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
  }
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
  }
  static get zero() {
    return new Vector3;
  }
  static get one() {
    return new Vector3(1, 1, 1);
  }
  toArray() {
    return [this._x, this._y, this._z];
  }
  set(x, y, z) {
    if (x !== undefined) {
      this._x = x;
    }
    if (y !== undefined) {
      this._y = y;
    }
    if (z !== undefined) {
      this._z = z;
    }
  }
  toFloat32Array() {
    return new Float32Array(this.toArray());
  }
  copyFrom(vector) {
    this._x = vector._x;
    this._y = vector._y;
    this._z = vector._z;
  }
  setFromJson(json) {
    if (json.x !== undefined) {
      this._x = Number(json.x);
    }
    if (json.y !== undefined) {
      this._y = Number(json.y);
    }
    if (json.z !== undefined) {
      this._z = Number(json.z);
    }
  }
  add(v) {
    this._x += v._x;
    this._y += v._y;
    this._z += v._z;
    return this;
  }
  subtract(v) {
    this._x -= v._x;
    this._y -= v._y;
    this._z -= v._z;
    return this;
  }
  multiply(v) {
    this._x *= v._x;
    this._y *= v._y;
    this._z *= v._z;
    return this;
  }
  divide(v) {
    this._x /= v._x;
    this._y /= v._y;
    this._z /= v._z;
    return this;
  }
  equals(v) {
    return this._x == v._x && this._y == v._y && this._z == v._z;
  }
  static distance(a, b) {
    let diff = a.subtract(b);
    return Math.sqrt(diff.x * diff.x + diff._y * diff.y + diff.z * diff.z);
  }
  clone() {
    return new Vector3(this._x, this._y, this._z);
  }
  toVector2() {
    return new Vector2(this._x, this._y);
  }
}

// src/core/math/vector2.ts
class Vector2 {
  _x;
  _y;
  constructor(x = 0, y = 0) {
    this._x = x;
    this._y = y;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
  }
  static get zero() {
    return new Vector2;
  }
  static get one() {
    return new Vector2(1, 1);
  }
  toArray() {
    return [this._x, this._y];
  }
  toFloat32Array() {
    return new Float32Array(this.toArray());
  }
  copyFrom(vector) {
    this._x = vector._x;
    this._y = vector._y;
  }
  setFromJson(json) {
    if (json.x !== undefined) {
      this._x = Number(json.x);
    }
    if (json.y !== undefined) {
      this._y = Number(json.y);
    }
  }
  set(x, y) {
    if (x !== undefined) {
      this._x = x;
    }
    if (y !== undefined) {
      this._y = y;
    }
  }
  toVector3() {
    return new Vector3(this._x, this._y, 0);
  }
  add(v) {
    this._x += v._x;
    this._y += v._y;
    return this;
  }
  subtract(v) {
    this._x -= v._x;
    this._y -= v._y;
    return this;
  }
  multiply(v) {
    this._x *= v._x;
    this._y *= v._y;
    return this;
  }
  divide(v) {
    this._x /= v._x;
    this._y /= v._y;
    return this;
  }
  static distance(a, b) {
    let diff = a.clone().subtract(b);
    return Math.sqrt(diff.x * diff.x + diff.y * diff.y);
  }
  clone() {
    return new Vector2(this._x, this._y);
  }
  scale(scale) {
    this._x *= scale;
    this._y *= scale;
    return this;
  }
}

// src/core/graphics/materialManager.ts
class MaterialReferenceNode {
  material;
  referenceCount = 1;
  constructor(material) {
    this.material = material;
  }
}

class MaterialManager {
  static _materials = {};
  constructor() {
  }
  static registerMaterial(material) {
    if (MaterialManager._materials[material.name] === undefined) {
      MaterialManager._materials[material.name] = new MaterialReferenceNode(material);
    }
  }
  static getMaterial(materialName) {
    if (MaterialManager._materials[materialName] === undefined) {
      return;
    } else {
      MaterialManager._materials[materialName].referenceCount++;
      return MaterialManager._materials[materialName].material;
    }
  }
  static releaseMaterial(materialName) {
    if (MaterialManager._materials[materialName] === undefined) {
      console.warn(`WARN: Cannot release a material which has not been registered, '${materialName}'.`);
    } else {
      MaterialManager._materials[materialName].referenceCount--;
      if (MaterialManager._materials[materialName].referenceCount < 1) {
        MaterialManager._materials[materialName].material.destroy();
        delete MaterialManager._materials[materialName];
      }
    }
  }
}

// src/core/gl/gl.ts
var gl;

class GLUtilities {
  static initialize(elementId) {
    let canvas;
    if (elementId !== undefined) {
      canvas = document.getElementById(elementId);
      if (canvas === undefined) {
        throw new Error("ERROR: Cannot find a canvas element named: " + elementId);
      }
    } else {
      canvas = document.createElement("canvas");
      document.body.appendChild(canvas);
    }
    const context = canvas.getContext("webgl");
    if (context === null) {
      throw new Error("ERROR: Unable to initialize WebGL!");
    }
    gl = context;
    return canvas;
  }
}

// src/core/gl/glBuffer.ts
class AttributeInfo {
  location;
  size;
  offset = 0;
}

class GLBuffer {
  _elementSize;
  _stride;
  _buffer;
  _targetBufferType;
  _dataType;
  _mode;
  _typeSize;
  _data = [];
  _hasAttributeLocation = false;
  _attributes = [];
  constructor(dataType = gl.FLOAT, targetBufferType = gl.ARRAY_BUFFER, mode = gl.TRIANGLES) {
    this._elementSize = 0;
    this._dataType = dataType;
    this._targetBufferType = targetBufferType;
    this._mode = mode;
    switch (this._dataType) {
      case gl.FLOAT:
      case gl.INT:
      case gl.UNSIGNED_INT:
        this._typeSize = 4;
        break;
      case gl.SHORT:
      case gl.UNSIGNED_SHORT:
        this._typeSize = 2;
        break;
      case gl.BYTE:
      case gl.UNSIGNED_BYTE:
        this._typeSize = 1;
        break;
      default:
        throw new Error("ERROR: Unrecognized data type: " + dataType.toString());
    }
    this._buffer = gl.createBuffer();
  }
  destroy() {
    gl.deleteBuffer(this._buffer);
  }
  bind(normalized = false) {
    gl.bindBuffer(this._targetBufferType, this._buffer);
    if (this._hasAttributeLocation) {
      for (let it of this._attributes) {
        gl.vertexAttribPointer(it.location, it.size, this._dataType, normalized, this._stride, it.offset * this._typeSize);
        gl.enableVertexAttribArray(it.location);
      }
    }
  }
  unbind() {
    for (let it of this._attributes) {
      gl.disableVertexAttribArray(it.location);
    }
    gl.bindBuffer(this._targetBufferType, null);
  }
  addAttributeLocation(info) {
    this._hasAttributeLocation = true;
    info.offset = this._elementSize;
    this._attributes.push(info);
    this._elementSize += info.size;
    this._stride = this._elementSize * this._typeSize;
  }
  setData(data) {
    this.clearData();
    this.pushBackData(data);
  }
  pushBackData(data) {
    for (let d of data) {
      this._data.push(d);
    }
  }
  clearData() {
    this._data.length = 0;
  }
  upload() {
    gl.bindBuffer(this._targetBufferType, this._buffer);
    let bufferData;
    switch (this._dataType) {
      case gl.FLOAT:
        bufferData = new Float32Array(this._data);
        break;
      case gl.INT:
        bufferData = new Int32Array(this._data);
        break;
      case gl.UNSIGNED_INT:
        bufferData = new Uint32Array(this._data);
        break;
      case gl.SHORT:
        bufferData = new Int16Array(this._data);
        break;
      case gl.UNSIGNED_SHORT:
        bufferData = new Uint16Array(this._data);
        break;
      case gl.BYTE:
        bufferData = new Int8Array(this._data);
        break;
      case gl.UNSIGNED_BYTE:
        bufferData = new Uint8Array(this._data);
        break;
      default:
        throw new Error(`ERROR: Unsupported data type: ${this._dataType}`);
    }
    gl.bufferData(this._targetBufferType, bufferData, gl.STATIC_DRAW);
  }
  draw() {
    if (this._targetBufferType === gl.ARRAY_BUFFER) {
      gl.drawArrays(this._mode, 0, this._data.length / this._elementSize);
    } else if (this._targetBufferType === gl.ELEMENT_ARRAY_BUFFER) {
      gl.drawElements(this._mode, this._data.length, this._dataType, 0);
    }
  }
}

// src/core/graphics/vertex.ts
class Vertex {
  position = Vector3.zero;
  texCoords = Vector2.zero;
  constructor(x = 0, y = 0, z = 0, tU = 0, tV = 0) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    this.texCoords.x = tU;
    this.texCoords.y = tV;
  }
  toArray() {
    let array = [];
    array = array.concat(this.position.toArray());
    array = array.concat(this.texCoords.toArray());
    return array;
  }
  float32Array() {
    return new Float32Array(this.toArray());
  }
}

// src/core/graphics/sprite.ts
class Sprite {
  _name;
  _width;
  _height;
  _buffer;
  _material;
  _materialName;
  _vertices = [];
  _origin = Vector3.zero;
  constructor(name, materialName, width = 100, height = 100) {
    this._name = name;
    this._width = width;
    this._height = height;
    this._materialName = materialName;
    this._material = MaterialManager.getMaterial(this._materialName);
  }
  load() {
    this._buffer = new GLBuffer;
    let positionAttribute = new AttributeInfo;
    positionAttribute.location = 0;
    positionAttribute.size = 3;
    this._buffer.addAttributeLocation(positionAttribute);
    let texCoordAttributes = new AttributeInfo;
    texCoordAttributes.location = 1;
    texCoordAttributes.size = 2;
    this._buffer.addAttributeLocation(texCoordAttributes);
    this.calculateVertices();
  }
  get name() {
    return this._name;
  }
  get origin() {
    return this._origin;
  }
  set origin(value) {
    this._origin = value;
    this.recalculateVertices();
  }
  get width() {
    return this._width;
  }
  destroy() {
    this._buffer.destroy();
    MaterialManager.releaseMaterial(this._materialName);
    this._material = undefined;
    this._materialName = undefined;
  }
  update(time) {
  }
  draw(shader, model) {
    let modelLocation = shader.getUniformLocation("u_model");
    gl.uniformMatrix4fv(modelLocation, false, model.toFloat32Array());
    let colorLocation = shader.getUniformLocation("u_tint");
    gl.uniform4fv(colorLocation, this._material.tint.toFloat32Array());
    if (this._material.diffuseTexture !== undefined) {
      this._material.diffuseTexture.activateAndBind(0);
      let diffuseLocation = shader.getUniformLocation("u_diffuse");
      gl.uniform1i(diffuseLocation, 0);
    }
    this._buffer.bind();
    this._buffer.draw();
  }
  calculateVertices() {
    let minX = -(this._width * this._origin.x);
    let maxX = this._width * (1 - this._origin.x);
    let minY = -(this._height * this._origin.y);
    let maxY = this._height * (1 - this._origin.y);
    this._vertices = [
      new Vertex(minX, minY, 0, 0, 0),
      new Vertex(minX, maxY, 0, 0, 1),
      new Vertex(maxX, maxY, 0, 1, 1),
      new Vertex(maxX, maxY, 0, 1, 1),
      new Vertex(maxX, minY, 0, 1, 0),
      new Vertex(minX, minY, 0, 0, 0)
    ];
    for (let v of this._vertices) {
      this._buffer.pushBackData(v.toArray());
    }
    this._buffer.upload();
    this._buffer.unbind();
  }
  recalculateVertices() {
    let minX = -(this._width * this._origin.x);
    let maxX = this._width * (1 - this._origin.x);
    let minY = -(this._height * this._origin.y);
    let maxY = this._height * (1 - this._origin.y);
    this._vertices[0].position.set(minX, minY);
    this._vertices[1].position.set(minX, maxY);
    this._vertices[2].position.set(maxX, maxY);
    this._vertices[3].position.set(maxX, maxY);
    this._vertices[4].position.set(maxX, minY);
    this._vertices[5].position.set(minX, minY);
    this._buffer.clearData();
    for (let v of this._vertices) {
      this._buffer.pushBackData(v.toArray());
    }
    this._buffer.upload();
    this._buffer.unbind();
  }
}

// src/core/graphics/animatedSprite.ts
class UVInfo {
  min;
  max;
  constructor(min, max) {
    this.max = max;
    this.min = min;
  }
}

class AnimatedSpriteInfo {
  name;
  materialName;
  width = 100;
  height = 100;
  frameWidth = 10;
  frameHeight = 10;
  frameCount = 1;
  frameSequence = [];
  frameTime = 60;
}

class AnimatedSprite extends Sprite {
  _frameWidth;
  _frameHeight;
  _frameCount;
  _frameSequence;
  _currentFrame = 0;
  _frameUVs = [];
  _frameTime = 111;
  _currentTime = 0;
  _assetLoaded = false;
  _assetWidth = 2;
  _assetHeight = 2;
  _isPlaying = true;
  frameTime = 33;
  constructor(info) {
    super(info.name, info.materialName, info.width, info.height);
    this._frameCount = info.frameCount;
    this._frameHeight = info.frameHeight;
    this._frameWidth = info.frameWidth;
    this._frameSequence = info.frameSequence;
    this._frameTime = info.frameTime;
    Message2.subscribe(MESSAGE_ASSET_LOADER_ASSET_LOADED + this._material.diffuseTextureName, this);
  }
  get isPlaying() {
    return this._isPlaying;
  }
  play() {
    this._isPlaying = true;
  }
  stop() {
    this._isPlaying = false;
  }
  setFrame(frameNumber) {
    if (frameNumber >= this._frameCount) {
      throw new Error(`ERROR: Frame is out of range: 
Frame Number'${frameNumber}' 
Frame Count: '${this._frameCount}'`);
    }
    this._currentFrame = frameNumber;
  }
  load() {
    super.load();
    if (!this._assetLoaded) {
      this.setUpFromMaterial();
    }
  }
  destroy() {
    super.destroy();
  }
  onMessage(message) {
    if (message.code === MESSAGE_ASSET_LOADER_ASSET_LOADED + this._material?.diffuseTextureName) {
      this._assetLoaded = true;
      let asset = message.context;
      this._assetHeight = asset.height;
      this._assetWidth = asset.width;
      this.calculateUVs();
    }
  }
  update(time) {
    if (!this._assetLoaded) {
      if (!this._assetLoaded) {
        this.setUpFromMaterial();
      }
      return;
    }
    if (!this._isPlaying) {
      return;
    }
    this._currentTime += time;
    if (this._currentTime > this._frameTime) {
      this._currentFrame++;
      this._currentTime = 0;
      if (this._currentFrame >= this._frameSequence.length) {
        this._currentFrame = 0;
      }
      let frameUVs = this._frameSequence[this._currentFrame];
      this._vertices[0].texCoords.copyFrom(this._frameUVs[frameUVs].min);
      this._vertices[1].texCoords = new Vector2(this._frameUVs[frameUVs].min.x, this._frameUVs[frameUVs].max.y);
      this._vertices[2].texCoords.copyFrom(this._frameUVs[frameUVs].max);
      this._vertices[3].texCoords.copyFrom(this._frameUVs[frameUVs].max);
      this._vertices[4].texCoords = new Vector2(this._frameUVs[frameUVs].max.x, this._frameUVs[frameUVs].min.y);
      this._vertices[5].texCoords.copyFrom(this._frameUVs[frameUVs].min);
      this._buffer.clearData();
      for (let v of this._vertices) {
        this._buffer.pushBackData(v.toArray());
      }
      this._buffer.upload();
      this._buffer.unbind();
    }
    super.update(time);
  }
  calculateUVs() {
    let totalWidth = 0;
    let yValue = 0;
    for (let i = 0;i < this._frameCount; ++i) {
      totalWidth += i * this._frameWidth;
      if (totalWidth > this._assetWidth) {
        yValue++;
        totalWidth = 0;
      }
      let u = i * this._frameWidth / this._assetWidth;
      let v = yValue * this._frameHeight / this._assetHeight;
      let min = new Vector2(u, v);
      let uMax = (i * this._frameWidth + this._frameWidth) / this._assetWidth;
      let vMax = (yValue * this._frameHeight + this._frameWidth) / this._assetHeight;
      let max = new Vector2(uMax, vMax);
      this._frameUVs.push(new UVInfo(min, max));
    }
  }
  setUpFromMaterial() {
    if (!this._assetLoaded) {
      let material = MaterialManager.getMaterial(this._materialName);
      if (material?.diffuseTexture?.isLoaded) {
        if (AssetManager.isAssetLoaded(material.diffuseTextureName)) {
          this._assetHeight = material.diffuseTexture.height;
          this._assetWidth = material.diffuseTexture.width;
          this._assetLoaded = true;
          this.calculateUVs();
        }
      }
    }
  }
}

// src/core/components/baseComponent.ts
class BaseComponent {
  _owner;
  name;
  _data;
  constructor(data) {
    this._data = data;
    this.name = data.name;
  }
  setOwner(owner) {
    this._owner = owner;
  }
  get owner() {
    return this._owner;
  }
  load() {
  }
  updateReady() {
  }
  update(time) {
  }
  render(shader) {
  }
}

// src/core/components/spriteComponent.ts
class SpriteComponentData {
  name;
  materialName;
  origin = Vector3.zero;
  width;
  height;
  setFromJson(json) {
    if (json.name !== undefined) {
      this.name = String(json.name);
    }
    if (json.width !== undefined) {
      this.width = Number(json.width);
    }
    if (json.height !== undefined) {
      this.height = Number(json.height);
    }
    if (json.materialName !== undefined) {
      this.materialName = String(json.materialName);
    }
    if (json.origin !== undefined) {
      this.origin.setFromJson(json.origin);
    }
  }
}

class SpriteComponentBuilder {
  get type() {
    return "sprite";
  }
  buildFromJson(json) {
    let data = new SpriteComponentData;
    data.setFromJson(json);
    return new Spritecomponent(data);
  }
}

class Spritecomponent extends BaseComponent {
  _sprite;
  _width;
  _height;
  constructor(data) {
    super(data);
    this._width = data.width;
    this._height = data.height;
    this._sprite = new Sprite(data.name, data.materialName, this._width, this._height);
    if (!data.origin.equals(Vector3.zero)) {
      this._sprite.origin.copyFrom(data.origin);
    }
  }
  load() {
    this._sprite.load();
  }
  render(shader) {
    this._sprite.draw(shader, this.owner.worldMatrix);
    super.render(shader);
  }
}

// src/core/components/animatedSpriteComponent.ts
class AnimatedSpriteComponentData extends SpriteComponentData {
  frameWidth;
  frameHeight;
  frameCount;
  frameSequence = [];
  autoPlay = true;
  frameTime = 33;
  setFromJson(json) {
    super.setFromJson(json);
    if (json.autoPlay !== undefined) {
      this.autoPlay = Boolean(json.autoPlay);
    }
    if (json.frameWidth === undefined) {
      throw new Error(`ERROR: AnimatedSpriteComponentData requires 'frameWidth' to be defined`);
    } else {
      this.frameWidth = Number(json.frameWidth);
    }
    if (json.frameHeight === undefined) {
      throw new Error(`ERROR: AnimatedSpriteComponentData requires 'frameHeight' to be defined`);
    } else {
      this.frameHeight = Number(json.frameHeight);
    }
    if (json.frameCount === undefined) {
      throw new Error(`ERROR: AnimatedSpriteComponentData requires 'frameCount' to be defined`);
    } else {
      this.frameCount = Number(json.frameCount);
    }
    if (json.frameSequence === undefined) {
      throw new Error(`ERROR: AnimatedSpriteComponentData requires 'frameSequence' to be defined`);
    } else {
      this.frameSequence = json.frameSequence;
    }
    if (json.frameTime !== undefined) {
      this.frameTime = Number(json.frameTime);
    }
  }
}

class AnimatedSpriteComponentBuilder {
  get type() {
    return "animatedSprite";
  }
  buildFromJson(json) {
    let data = new AnimatedSpriteComponentData;
    data.setFromJson(json);
    return new AnimatedSpriteComponent(data);
  }
}

class AnimatedSpriteComponent extends BaseComponent {
  _sprite;
  _autoPlay;
  constructor(data) {
    super(data);
    this._autoPlay = data.autoPlay;
    let spriteInfo = new AnimatedSpriteInfo;
    spriteInfo.name = data.name;
    spriteInfo.materialName = data.materialName;
    spriteInfo.frameWidth = data.frameWidth;
    spriteInfo.frameHeight = data.frameHeight;
    spriteInfo.width = data.frameWidth;
    spriteInfo.height = data.frameHeight;
    spriteInfo.frameCount = data.frameCount;
    spriteInfo.frameSequence = data.frameSequence;
    spriteInfo.frameTime = data.frameTime;
    this._sprite = new AnimatedSprite(spriteInfo);
    if (!data.origin.equals(Vector3.zero)) {
      this._sprite.origin.copyFrom(data.origin);
    }
  }
  get isPlaying() {
    return this._sprite.isPlaying;
  }
  play() {
    this._sprite.play();
  }
  stop() {
    this._sprite.stop();
  }
  load() {
    this._sprite.load();
  }
  updateReady() {
    if (!this._autoPlay) {
      this._sprite.stop();
    }
  }
  update(time) {
    this._sprite.update(time);
    super.update(time);
  }
  setFrame(frameNumber) {
    this._sprite.setFrame(frameNumber);
  }
  render(shader) {
    this._sprite.draw(shader, this.owner.worldMatrix);
    super.render(shader);
  }
}

// src/core/collision/collisionManager.ts
class CollisionData {
  a;
  b;
  time;
  constructor(time, a, b) {
    this.time = time;
    this.a = a;
    this.b = b;
  }
}

class CollisionManager {
  static _collisionComponents = [];
  static _collisionData = [];
  static _totalTime = 0;
  constructor() {
  }
  static registerCollisionComponent(component) {
    CollisionManager._collisionComponents.push(component);
  }
  static unRegisterCollisionComponent(component) {
    let index = CollisionManager._collisionComponents.indexOf(component);
    if (index !== -1) {
      CollisionManager._collisionComponents.slice(index, 1);
    }
  }
  static clear() {
    CollisionManager._collisionComponents.length = 0;
  }
  static update(time) {
    CollisionManager._totalTime += time;
    for (let c = 0;c < CollisionManager._collisionComponents.length; ++c) {
      let comp = CollisionManager._collisionComponents[c];
      for (let ob = 0;ob < CollisionManager._collisionComponents.length; ++ob) {
        let other = CollisionManager._collisionComponents[ob];
        if (comp === other) {
          continue;
        }
        if (comp.isStatic && other.isStatic) {
          continue;
        }
        if (comp.shape.intersects(other.shape)) {
          let exists = false;
          for (let d = 0;d < CollisionManager._collisionData.length; ++d) {
            let data = CollisionManager._collisionData[d];
            if (data.a === comp && data.b === other || data.a === other && data.b === comp) {
              comp.onCollisionUpdate(other);
              other.onCollisionUpdate(comp);
              data.time = CollisionManager._totalTime;
              exists = true;
              break;
            }
          }
          if (!exists) {
            let col = new CollisionData(CollisionManager._totalTime, comp, other);
            comp.onCollisionEntry(other);
            other.onCollisionEntry(comp);
            Message2.sendPriority("COLLISION_ENTRY", undefined, col);
            this._collisionData.push(col);
          }
        }
      }
    }
    let removeData = [];
    for (let d = 0;d < CollisionManager._collisionData.length; ++d) {
      let data = CollisionManager._collisionData[d];
      if (data.time !== CollisionManager._totalTime) {
        removeData.push(data);
      }
    }
    while (removeData.length !== 0) {
      let data = removeData.shift();
      let index = CollisionManager._collisionData.indexOf(data);
      CollisionManager._collisionData.splice(index, 1);
      data.a.onCollisionExit(data.b);
      data.b.onCollisionExit(data.a);
      Message2.sendPriority("COLLISION_EXIT", undefined, data);
    }
  }
}

// src/core/graphics/shapes2D/rectangle2d.ts
class Rectangle2D {
  position = Vector2.zero;
  origin = Vector2.zero;
  width;
  height;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.position.x = x;
    this.position.y = y;
    this.width = width;
    this.height = height;
  }
  get offset() {
    return new Vector2(this.width * this.origin.x, this.height * this.origin.y);
  }
  setFromJson(json) {
    if (json.position !== undefined) {
      this.position.setFromJson(json.position);
    }
    if (json.origin !== undefined) {
      this.origin.setFromJson(json.origin);
    }
    if (json.width === undefined) {
      throw new Error(`Rectangle2D requires 'width' to be present.`);
    }
    this.width = Number(json.width);
    if (json.height === undefined) {
      throw new Error(`Rectangle2D requires 'height' to be present.`);
    }
    this.height = Number(json.height);
  }
  intersects(other) {
    if (other instanceof Rectangle2D) {
      let a = this.getExtents(this);
      let b = this.getExtents(other);
      return a.position.x <= b.width && a.width >= b.position.x && a.position.y <= b.height && a.height >= b.position.y;
    }
    if (other instanceof Circle2D) {
      let closestX = Math.max(this.position.x, Math.min(other.position.x, this.position.x + this.width));
      let closestY = Math.max(this.position.y, Math.min(other.position.y, this.position.y + this.height));
      let deltaX = other.position.x - closestX;
      let deltaY = other.position.y - closestY;
      return deltaX * deltaX + deltaY * deltaY < other.radius * other.radius;
    }
    return false;
  }
  getExtents(shape) {
    let x = shape.width < 0 ? shape.position.x - shape.width : shape.position.x;
    let y = shape.height < 0 ? shape.position.y - shape.height : shape.position.y;
    let extentX = shape.width < 0 ? shape.position.x : shape.position.x + shape.width;
    let extentY = shape.height < 0 ? shape.position.y : shape.position.y + shape.height;
    return new Rectangle2D(x, y, extentX, extentY);
  }
  pointInShape(point) {
    let x = this.width < 0 ? this.position.x - this.width : this.position.x;
    let y = this.height < 0 ? this.position.y - this.height : this.position.y;
    let extentX = this.width < 0 ? this.position.x : this.position.x + this.width;
    let extentY = this.height < 0 ? this.position.y : this.position.y + this.height;
    return point.x >= x && point.x <= extentX && point.y >= y && point.y <= extentY;
  }
}

// src/core/graphics/shapes2D/circle2D.ts
class Circle2D {
  position = Vector2.zero;
  origin = Vector2.zero;
  radius;
  get offset() {
    return new Vector2(this.radius + this.radius * this.origin.x, this.radius + this.radius * this.origin.y);
  }
  setFromJson(json) {
    if (json.position !== undefined) {
      this.position.setFromJson(json.position);
    }
    if (json.origin !== undefined) {
      this.origin.setFromJson(json.origin);
    }
    if (json.radius === undefined) {
      throw new Error(`Circle2D requires 'radius' to be present.`);
    }
    this.radius = Number(json.radius);
  }
  intersects(other) {
    if (other instanceof Circle2D) {
      let distance = Math.abs(Vector2.distance(other.position, this.position));
      let radiusLength = this.radius + other.radius;
      return distance <= radiusLength;
    }
    if (other instanceof Rectangle2D) {
      let closestX = Math.max(other.position.x, Math.min(this.position.x, other.position.x + other.width));
      let closestY = Math.max(other.position.y, Math.min(this.position.y, other.position.y + other.height));
      let deltaX = this.position.x - closestX;
      let deltaY = this.position.y - closestY;
      return deltaX * deltaX + deltaY * deltaY < this.radius * this.radius;
    }
    return false;
  }
  pointInShape(point) {
    let absDistance = Math.abs(Vector2.distance(this.position, point));
    return absDistance <= this.radius;
  }
}

// src/core/components/collisionComponent.ts
class CollisionComponentData {
  name;
  shape;
  static = true;
  setFromJson(json) {
    if (json.name !== undefined) {
      this.name = String(json.name);
    }
    if (json.static !== undefined) {
      this.static = Boolean(json.static);
    }
    if (json.shape === undefined) {
      throw new Error(`ERROR: CollisionComponentData requries 'shape', to be present `);
    } else {
      if (json.shape.type === undefined) {
        throw new Error(`ERROR: CollisionComponentData requires 'shape.type', to be present`);
      }
      let shapeType = String(json.shape.type).toLowerCase();
      switch (shapeType) {
        case "rectangle":
          this.shape = new Rectangle2D;
          break;
        case "circle":
          this.shape = new Circle2D;
          break;
        default:
          throw new Error(`ERROR: Unsupported shape.type, '${shapeType}'`);
      }
    }
    this.shape.setFromJson(json.shape);
  }
}

class CollisionComponentBuilder {
  get type() {
    return "collision";
  }
  buildFromJson(json) {
    let data = new CollisionComponentData;
    data.setFromJson(json);
    return new CollisionComponent(data);
  }
}

class CollisionComponent extends BaseComponent {
  _shape;
  _static;
  constructor(data) {
    super(data);
    this._shape = data.shape;
    this._static = data.static;
  }
  get shape() {
    return this._shape;
  }
  get isStatic() {
    return this._static;
  }
  load() {
    super.load();
    this._shape.position.copyFrom(this.owner.getWorldPosition().toVector2().subtract(this._shape.offset));
    CollisionManager.registerCollisionComponent(this);
  }
  update(time) {
    this._shape.position.copyFrom(this.owner.getWorldPosition().toVector2().subtract(this._shape.offset));
    super.update(time);
  }
  render(shader) {
    super.render(shader);
  }
  onCollisionEntry(other) {
  }
  onCollisionUpdate(other) {
  }
  onCollisionExit(other) {
  }
}

// src/core/components/componentManager.ts
class ComponentManager {
  static _registeredBuilders = {};
  static registerBuilder(builder) {
    ComponentManager._registeredBuilders[builder.type] = builder;
  }
  static extractComponent(json) {
    if (json.type !== undefined) {
      if (ComponentManager._registeredBuilders[String(json.type)] !== undefined) {
        return ComponentManager._registeredBuilders[String(json.type)].buildFromJson(json);
      }
    }
    throw new Error(`ERROR: Component manager error - type missing or builder is not registered for this type '${json.type}'.`);
  }
}

// src/core/audio/audioManager.ts
class SoundEffect {
  assetPath;
  _player;
  constructor(assetPath, loop) {
    this._player = new Audio(assetPath);
    this._player.loop = loop;
  }
  get loop() {
    return this._player.loop;
  }
  set loop(value) {
    this._player.loop = value;
  }
  destroy() {
    this._player = undefined;
  }
  play() {
    if (!this._player.paused) {
      this.stop();
    }
    this._player.play();
  }
  pause() {
    this._player.pause();
  }
  stop() {
    this._player.pause();
    this._player.currentTime = 0;
  }
}

class AudioManager {
  static _soundEffects = {};
  static loadSoundFile(name, assetPath, loop) {
    AudioManager._soundEffects[name] = new SoundEffect(assetPath, loop);
  }
  static playSound(name) {
    if (AudioManager._soundEffects[name] !== undefined) {
      AudioManager._soundEffects[name].play();
    }
  }
  static pauseSound(name) {
    if (AudioManager._soundEffects[name] !== undefined) {
      AudioManager._soundEffects[name].pause();
    }
  }
  static pauseAll() {
    for (let sfx in AudioManager._soundEffects) {
      if (AudioManager._soundEffects[sfx] !== undefined) {
        AudioManager._soundEffects[sfx].pause();
      }
    }
  }
  static stopSound(name) {
    if (AudioManager._soundEffects[name] !== undefined) {
      AudioManager._soundEffects[name].stop();
    }
  }
  static stopAll() {
    for (let sfx in AudioManager._soundEffects) {
      if (AudioManager._soundEffects[sfx] !== undefined) {
        AudioManager._soundEffects[sfx].stop();
      }
    }
  }
}

// src/core/behaviours/behaviourManager.ts
class BehaviourManager {
  static _registeredBuilders = {};
  static registerBuilder(builder) {
    BehaviourManager._registeredBuilders[builder.type] = builder;
  }
  static extractBehaviour(json) {
    if (json.type !== undefined) {
      if (BehaviourManager._registeredBuilders[String(json.type)] !== undefined) {
        return BehaviourManager._registeredBuilders[String(json.type)].buildFromJson(json);
      }
      throw new Error(`ERROR: Behaviour manager error - type missing or behaviour is not registered for this type '${json.type}'.`);
    }
  }
}

// src/core/input/inputManager.ts
class MouseContext {
  leftDown;
  rightDown;
  position;
  constructor(leftDown, rightDown, position) {
    this.leftDown = leftDown;
    this.rightDown = rightDown;
    this.position = position;
  }
}

class InputManager {
  static _keys = [];
  static _mouseX;
  static _mouseY;
  static _previousMouseX;
  static _previousMouseY;
  static _leftDown = false;
  static _rightDown = false;
  static _resolutionScale = Vector2.one;
  static initialize(viewPort) {
    for (let i = 0;i < 255; ++i) {
      InputManager._keys[i] = false;
    }
    window.addEventListener("keydown", InputManager.onKeyDown);
    window.addEventListener("keyup", InputManager.onKeyUp);
    window.addEventListener("mousemove", InputManager.onMouseMove);
    window.addEventListener("mousedown", InputManager.onMouseDown);
    window.addEventListener("mouseup", InputManager.onMouseUp);
    window.addEventListener("touchstart", InputManager.onTouchStart, {
      passive: false
    });
    window.addEventListener("touchmove", InputManager.onTouchMove, {
      passive: false
    });
    window.addEventListener("touchend", InputManager.onTouchEnd, {
      passive: false
    });
    window.addEventListener("touchcancel", InputManager.onTouchCancel, {
      passive: false
    });
  }
  static isKeyDown(key) {
    return InputManager._keys[key];
  }
  static getMousePosition() {
    return new Vector2(this._mouseX, this._mouseY);
  }
  static setResolutionScale(scale) {
    InputManager._resolutionScale.copyFrom(scale);
  }
  static onKeyDown(event) {
    InputManager._keys[event.keyCode] = true;
    return true;
  }
  static onKeyUp(event) {
    InputManager._keys[event.keyCode] = false;
    return true;
  }
  static onMouseMove(event) {
    InputManager._previousMouseX = InputManager._mouseX;
    InputManager._previousMouseY = InputManager._mouseY;
    let rect = event.target.getBoundingClientRect();
    InputManager._mouseX = (event.clientX - Math.round(rect.left)) * (1 / InputManager._resolutionScale.x);
    InputManager._mouseY = (event.clientY - Math.round(rect.top)) * (1 / InputManager._resolutionScale.y);
  }
  static onMouseDown(event) {
    if (event.button === 0) {
      this._leftDown = true;
    } else if (event.button === 2) {
      this._rightDown = true;
    }
    Message2.send("MOUSE_DOWN", this, new MouseContext(InputManager._leftDown, InputManager._rightDown, InputManager.getMousePosition()));
  }
  static onMouseUp(event) {
    if (event.button === 0) {
      this._leftDown = false;
    } else if (event.button === 2) {
      this._rightDown = false;
    }
    Message2.send("MOUSE_UP", this, new MouseContext(InputManager._leftDown, InputManager._rightDown, InputManager.getMousePosition()));
  }
  static onTouchStart(event) {
    const touch = event.touches[0];
    InputManager._leftDown = true;
    const rect = event.target.getBoundingClientRect();
    InputManager._mouseX = (touch.clientX - Math.round(rect.left)) * (1 / InputManager._resolutionScale.x);
    InputManager._mouseY = (touch.clientY - Math.round(rect.top)) * (1 / InputManager._resolutionScale.y);
    Message2.send("MOUSE_DOWN", this, new MouseContext(true, false, InputManager.getMousePosition()));
    event.preventDefault();
  }
  static onTouchMove(event) {
    const touch = event.touches[0];
    const rect = event.target.getBoundingClientRect();
    InputManager._previousMouseX = InputManager._mouseX;
    InputManager._previousMouseY = InputManager._mouseY;
    InputManager._mouseX = (touch.clientX - Math.round(rect.left)) * (1 / InputManager._resolutionScale.x);
    InputManager._mouseY = (touch.clientY - Math.round(rect.top)) * (1 / InputManager._resolutionScale.y);
    event.preventDefault();
  }
  static onTouchEnd(event) {
    InputManager._leftDown = false;
    Message2.send("MOUSE_UP", this, new MouseContext(false, false, InputManager.getMousePosition()));
    event.preventDefault();
  }
  static onTouchCancel(event) {
    InputManager._leftDown = false;
    event.preventDefault();
  }
}

// src/core/behaviours/baseBehaviour.ts
class BaseBehaviour {
  name;
  _data;
  _owner;
  constructor(data) {
    this._data = data;
    this.name = this._data.name;
  }
  setOwner(owner) {
    this._owner = owner;
  }
  updateReady() {
  }
  update(time) {
  }
  apply(userData) {
  }
}

// src/core/behaviours/keyboardMovementBehaviour.ts
class KeyboardMovementBehaviourData {
  name;
  speed = 0.1;
  setFromJson(json) {
    if (json.name === undefined) {
      throw new Error("ERROR: Name must be defined in behaviour data.");
    } else {
      this.name = String(json.name);
    }
    if (json.speed !== undefined) {
      this.speed = Number(json.speed);
    }
  }
}

class KeyboardMovementBehaviourBuilder {
  get type() {
    return "keyboardMovement";
  }
  buildFromJson(json) {
    let data = new KeyboardMovementBehaviourData;
    data.setFromJson(json);
    return new KeyboardMovementBehaviour(data);
  }
}

class KeyboardMovementBehaviour extends BaseBehaviour {
  speed = 0.1;
  constructor(data) {
    super(data);
    this.speed = data.speed;
  }
  update(time) {
    if (InputManager.isKeyDown(37 /* LEFT */)) {
      this._owner.transform.position.x -= this.speed;
    }
    if (InputManager.isKeyDown(39 /* RIGHT */)) {
      this._owner.transform.position.x += this.speed;
    }
    if (InputManager.isKeyDown(38 /* UP */)) {
      this._owner.transform.position.y -= this.speed;
    }
    if (InputManager.isKeyDown(40 /* DOWN */)) {
      this._owner.transform.position.y += this.speed;
    }
    super.update(time);
  }
}

// src/core/behaviours/rotationBehaviour.ts
class RotationBehaviourData {
  name;
  rotation = Vector3.zero;
  setFromJson(json) {
    if (json.name === undefined) {
      throw new Error("ERROR: Name must be defined in behaviour data.");
    }
    this.name = String(json.name);
    if (json.rotation !== undefined) {
      this.rotation.setFromJson(json.rotation);
    }
  }
}

class RotationBehaviourBuilder {
  get type() {
    return "rotation";
  }
  buildFromJson(json) {
    let data = new RotationBehaviourData;
    data.setFromJson(json);
    return new RotationBehaviour(data);
  }
}

class RotationBehaviour extends BaseBehaviour {
  _rotation;
  constructor(data) {
    super(data);
    this._rotation = data.rotation;
  }
  update(time) {
    this._owner.transform.rotation.add(this._rotation);
    super.update(time);
  }
}

// src/core/graphics/color.ts
class Color {
  _r;
  _g;
  _b;
  _a;
  constructor(r = 255, g = 255, b = 255, a = 255) {
    this._r = r;
    this._g = g;
    this._b = b;
    this._a = a;
  }
  get r() {
    return this._r;
  }
  get rFloat() {
    return this._r / 255;
  }
  set r(value) {
    this._r = value;
  }
  get g() {
    return this._g;
  }
  get gFloat() {
    return this._g / 255;
  }
  set g(value) {
    this._g = value;
  }
  get b() {
    return this._b;
  }
  get bFloat() {
    return this._b / 255;
  }
  set b(value) {
    this._b = value;
  }
  get a() {
    return this._a;
  }
  get aFloat() {
    return this._a / 255;
  }
  set a(value) {
    this._a = value;
  }
  toArray() {
    return [this._r, this._g, this._b, this._a];
  }
  toFloatArray() {
    return [this._r / 255, this._g / 255, this._b / 255, this._a / 255];
  }
  toFloat32Array() {
    return new Float32Array(this.toFloatArray());
  }
  static white() {
    return new Color(255, 255, 255, 255);
  }
  static black() {
    return new Color(0, 0, 0, 255);
  }
  static red() {
    return new Color(255, 0, 0, 255);
  }
  static green() {
    return new Color(0, 255, 0, 255);
  }
  static blue() {
    return new Color(0, 0, 255, 255);
  }
}

// src/core/graphics/texture.ts
var LEVEL = 0;
var BORDER = 0;
var TEMP_IMAGE_DATA = new Uint8Array([255, 255, 255, 255]);

class Texture {
  _name;
  _handle;
  _isloaded = false;
  _width;
  _height;
  constructor(name, width = 1, height = 1) {
    this._name = name;
    this._width = width;
    this._height = height;
    this._handle = gl.createTexture();
    this.bind();
    gl.texImage2D(gl.TEXTURE_2D, LEVEL, gl.RGBA, 1, 1, BORDER, gl.RGBA, gl.UNSIGNED_BYTE, TEMP_IMAGE_DATA);
    let asset = AssetManager.getAsset(this._name);
    if (asset !== undefined) {
      this.loadTextureFromAsset(asset);
    } else {
      Message2.subscribe(MESSAGE_ASSET_LOADER_ASSET_LOADED + this._name, this);
    }
  }
  get isLoaded() {
    return this._isloaded;
  }
  get name() {
    return this._name;
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  activateAndBind(textureUnit = 0) {
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    this.bind();
  }
  bind() {
    gl.bindTexture(gl.TEXTURE_2D, this._handle);
  }
  unbind() {
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  destroy() {
    gl.deleteTexture(this._handle);
  }
  onMessage(message) {
    if (message.code === MESSAGE_ASSET_LOADER_ASSET_LOADED + this._name) {
      this.loadTextureFromAsset(message.context);
    }
  }
  loadTextureFromAsset(asset) {
    this._width = asset.width;
    this._height = asset.height;
    this.bind();
    gl.texImage2D(gl.TEXTURE_2D, LEVEL, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset.data);
    if (this.isPowerOf2()) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this._isloaded = true;
  }
  isPowerOf2() {
    return this.isValuePowerOf2(this._width) && this.isValuePowerOf2(this._height);
  }
  isValuePowerOf2(value) {
    return (value & value - 1) == 0;
  }
}

// src/core/graphics/textureManager.ts
class TextureReferenceNode {
  texture;
  referenceCount = 1;
  constructor(texture) {
    this.texture = texture;
  }
}

class TextureManager {
  static _textures = {};
  constructor() {
  }
  static getTexture(textureName) {
    if (TextureManager._textures[textureName] === undefined) {
      let texture = new Texture(textureName);
      TextureManager._textures[textureName] = new TextureReferenceNode(texture);
    } else {
      TextureManager._textures[textureName].referenceCount++;
    }
    return TextureManager._textures[textureName].texture;
  }
  static releaseTexture(textureName) {
    if (TextureManager._textures[textureName] === undefined) {
      console.warn(`WARN: A texture named '${textureName}' does not exist and cannot be released.`);
    } else {
      TextureManager._textures[textureName].referenceCount--;
      if (TextureManager._textures[textureName].referenceCount < 1) {
        TextureManager._textures[textureName].texture.destroy();
        delete TextureManager._textures[textureName];
      }
    }
  }
}

// src/core/graphics/material.ts
class Material {
  _name;
  _diffuseTextureName;
  _diffuseTexture;
  _tint;
  constructor(name, diffuseTextureName, tint) {
    this._name = name;
    this._diffuseTextureName = diffuseTextureName;
    this._tint = tint;
    if (this._diffuseTextureName !== undefined) {
      this._diffuseTexture = TextureManager.getTexture(this._diffuseTextureName);
    }
  }
  get name() {
    return this._name;
  }
  get diffuseTextureName() {
    return this._diffuseTextureName;
  }
  get diffuseTexture() {
    return this._diffuseTexture;
  }
  get tint() {
    return this._tint;
  }
  set diffuseTextureName(value) {
    if (this._diffuseTexture !== undefined) {
      TextureManager.releaseTexture(this._diffuseTextureName);
    }
    this._diffuseTextureName = value;
    if (this._diffuseTextureName !== undefined) {
      this._diffuseTexture = TextureManager.getTexture(this._diffuseTextureName);
    }
  }
  destroy() {
    TextureManager.releaseTexture(this._diffuseTextureName);
    this._diffuseTexture = undefined;
  }
}

// src/core/math/matrix4x4.ts
class Matrix4x4 {
  _data = [];
  constructor() {
    this._data = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  get data() {
    return this._data;
  }
  static identity() {
    return new Matrix4x4;
  }
  static orthographic(left, right, bottom, top, nearClip, farClip) {
    let m = new Matrix4x4;
    let lr = 1 / (left - right);
    let bt = 1 / (bottom - top);
    let nf = 1 / (nearClip - farClip);
    m._data[0] = -2 * lr;
    m._data[5] = -2 * bt;
    m._data[10] = 2 * nf;
    m._data[12] = (left + right) * lr;
    m._data[13] = (top + bottom) * bt;
    m._data[14] = (farClip + nearClip) * nf;
    return m;
  }
  static translation(position) {
    let m = new Matrix4x4;
    m._data[12] = position.x;
    m._data[13] = position.y;
    m._data[14] = position.z;
    return m;
  }
  static rotationX(angleInRadians) {
    let m = new Matrix4x4;
    let c = Math.cos(angleInRadians);
    let s = Math.sin(angleInRadians);
    m._data[5] = c;
    m._data[6] = s;
    m._data[9] = -s;
    m._data[10] = c;
    return m;
  }
  static rotationY(angleInRadians) {
    let m = new Matrix4x4;
    let c = Math.cos(angleInRadians);
    let s = Math.sin(angleInRadians);
    m._data[0] = c;
    m._data[2] = -s;
    m._data[8] = s;
    m._data[10] = c;
    return m;
  }
  static rotationZ(angleInRadians) {
    let m = new Matrix4x4;
    let c = Math.cos(angleInRadians);
    let s = Math.sin(angleInRadians);
    m._data[0] = c;
    m._data[1] = s;
    m._data[4] = -s;
    m._data[5] = c;
    return m;
  }
  static rotationXYZ(xRadians, yRadians, zRadians) {
    let rx = Matrix4x4.rotationX(xRadians);
    let ry = Matrix4x4.rotationY(yRadians);
    let rz = Matrix4x4.rotationZ(zRadians);
    return Matrix4x4.multiply(Matrix4x4.multiply(rz, ry), rx);
  }
  static scale(scale) {
    let m = new Matrix4x4;
    m._data[0] = scale.x;
    m._data[5] = scale.y;
    m._data[10] = scale.z;
    return m;
  }
  static multiply(a, b) {
    let m = new Matrix4x4;
    let b00 = b._data[0 * 4 + 0];
    let b01 = b._data[0 * 4 + 1];
    let b02 = b._data[0 * 4 + 2];
    let b03 = b._data[0 * 4 + 3];
    let b10 = b._data[1 * 4 + 0];
    let b11 = b._data[1 * 4 + 1];
    let b12 = b._data[1 * 4 + 2];
    let b13 = b._data[1 * 4 + 3];
    let b20 = b._data[2 * 4 + 0];
    let b21 = b._data[2 * 4 + 1];
    let b22 = b._data[2 * 4 + 2];
    let b23 = b._data[2 * 4 + 3];
    let b30 = b._data[3 * 4 + 0];
    let b31 = b._data[3 * 4 + 1];
    let b32 = b._data[3 * 4 + 2];
    let b33 = b._data[3 * 4 + 3];
    let a00 = a._data[0 * 4 + 0];
    let a01 = a._data[0 * 4 + 1];
    let a02 = a._data[0 * 4 + 2];
    let a03 = a._data[0 * 4 + 3];
    let a10 = a._data[1 * 4 + 0];
    let a11 = a._data[1 * 4 + 1];
    let a12 = a._data[1 * 4 + 2];
    let a13 = a._data[1 * 4 + 3];
    let a20 = a._data[2 * 4 + 0];
    let a21 = a._data[2 * 4 + 1];
    let a22 = a._data[2 * 4 + 2];
    let a23 = a._data[2 * 4 + 3];
    let a30 = a._data[3 * 4 + 0];
    let a31 = a._data[3 * 4 + 1];
    let a32 = a._data[3 * 4 + 2];
    let a33 = a._data[3 * 4 + 3];
    m._data[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    m._data[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    m._data[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    m._data[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
    m._data[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    m._data[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    m._data[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    m._data[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
    m._data[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    m._data[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    m._data[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    m._data[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
    m._data[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    m._data[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    m._data[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    m._data[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
    return m;
  }
  toFloat32Array() {
    return new Float32Array(this._data);
  }
  copyFrom(m) {
    for (let i = 0;i < 16; ++i) {
      this._data[i] = m._data[i];
    }
  }
}

// src/core/math/transform.ts
class Transform {
  position = Vector3.zero;
  rotation = Vector3.zero;
  scale = Vector3.one;
  copyFrom(transform) {
    this.position.copyFrom(transform.position);
    this.rotation.copyFrom(transform.rotation);
    this.scale.copyFrom(transform.scale);
  }
  getTransformationMatrix() {
    let translation = Matrix4x4.translation(this.position);
    let rotation = Matrix4x4.rotationXYZ(this.rotation.x, this.rotation.y, this.rotation.z);
    let scale = Matrix4x4.scale(this.scale);
    return Matrix4x4.multiply(Matrix4x4.multiply(translation, rotation), scale);
  }
  setFromJson(json) {
    if (json.position !== undefined) {
      this.position.setFromJson(json.position);
    }
    if (json.rotation !== undefined) {
      this.rotation.setFromJson(json.rotation);
    }
    if (json.scale !== undefined) {
      this.scale.setFromJson(json.scale);
    }
  }
}

// src/core/world/simObject.ts
class SimObject {
  _id;
  _children = [];
  _parent;
  _isLoaded = false;
  _scene;
  _components = [];
  _localMatrix = Matrix4x4.identity();
  _worldMatrix = Matrix4x4.identity();
  name;
  transform = new Transform;
  _behaviours = [];
  _isVisible = true;
  constructor(id, name, scene) {
    this._id = id;
    this.name = name;
    this._scene = scene;
  }
  get id() {
    return this._id;
  }
  get parent() {
    return this._parent;
  }
  get worldMatrix() {
    return this._worldMatrix;
  }
  get isLoaded() {
    return this._isLoaded;
  }
  get isVisible() {
    return this._isVisible;
  }
  set isVisible(value) {
    this._isVisible = value;
  }
  addChild(child) {
    child._parent = this;
    this._children.push(child);
    child.onAdded(this._scene);
  }
  removeChild(child) {
    let index = this._children.indexOf(child);
    if (index !== -1) {
      child._parent = undefined;
      this._children.splice(index, 1);
    }
  }
  getBehaviourByName(name) {
    for (let behaviour of this._behaviours) {
      if (behaviour.name === name) {
        return behaviour;
      }
    }
    for (let child of this._children) {
      let behaviour = child.getBehaviourByName(name);
      if (behaviour !== undefined) {
        return behaviour;
      }
      return;
    }
  }
  getComponentByName(name) {
    for (let component of this._components) {
      if (component.name === name) {
        return component;
      }
    }
    for (let child of this._children) {
      let component = child.getComponentByName(name);
      if (component !== undefined) {
        return component;
      }
      return;
    }
  }
  getObjectByName(name) {
    if (this.name === name) {
      return this;
    }
    for (let child of this._children) {
      let result = child.getObjectByName(name);
      if (result !== undefined) {
        return result;
      }
      return;
    }
  }
  addComponent(component) {
    this._components.push(component);
    component.setOwner(this);
  }
  addBehavour(behaviour) {
    this._behaviours.push(behaviour);
    behaviour.setOwner(this);
  }
  load() {
    this._isLoaded = true;
    for (let c of this._components) {
      c.load();
    }
    for (let c of this._children) {
      c.load();
    }
  }
  updateReady() {
    for (let c of this._components) {
      c.updateReady();
    }
    for (let b of this._behaviours) {
      b.updateReady();
    }
    for (let c of this._children) {
      c.updateReady();
    }
  }
  update(time) {
    this._localMatrix = this.transform.getTransformationMatrix();
    this.updateWorldMatrix(this._parent !== undefined ? this._parent.worldMatrix : undefined);
    for (let c of this._components) {
      c.update(time);
    }
    for (let b of this._behaviours) {
      b.update(time);
    }
    for (let c of this._children) {
      c.update(time);
    }
  }
  render(shader) {
    if (!this._isVisible) {
      return;
    }
    for (let c of this._components) {
      c.render(shader);
    }
    for (let c of this._children) {
      c.render(shader);
    }
  }
  onAdded(scene) {
    this._scene = scene;
  }
  updateWorldMatrix(parentWorldMatrix) {
    if (parentWorldMatrix !== undefined) {
      this._worldMatrix = Matrix4x4.multiply(parentWorldMatrix, this._localMatrix);
    } else {
      this._worldMatrix.copyFrom(this._localMatrix);
    }
  }
  getWorldPosition() {
    return new Vector3(this._worldMatrix.data[12], this._worldMatrix.data[13], this._worldMatrix.data[14]);
  }
}

// src/core/world/scene.ts
class Scene {
  _root;
  constructor() {
    this._root = new SimObject(0, "__ROOT__", this);
  }
  get root() {
    return this._root;
  }
  get isLoaded() {
    return this._root.isLoaded;
  }
  addObject(object) {
    this._root.addChild(object);
  }
  getObjectByName(name) {
    this._root.getObjectByName(name);
  }
  load() {
    this._root.load();
  }
  update(time) {
    this._root.update(time);
  }
  render(shader) {
    this._root.render(shader);
  }
}

// src/core/world/zone.ts
class Zone {
  _id;
  _name;
  _description;
  _scene;
  _state = 0 /* UNINITIALIZED */;
  _globalID = -1;
  constructor(id, name, description) {
    this._id = id;
    this._name = name;
    this._description = description;
    this._scene = new Scene;
  }
  get id() {
    return this._id;
  }
  get name() {
    return this._name;
  }
  get description() {
    return this._description;
  }
  get scene() {
    return this._scene;
  }
  initialize(zoneData) {
    if (zoneData.objects === undefined) {
      throw new Error("ERROR: Zone initialization error: 'objects' not present");
    }
    for (let ob in zoneData.objects) {
      let obj = zoneData.objects[ob];
      this.loadSimObject(obj, this._scene.root);
    }
  }
  load() {
    this._state = 1 /* LOADING */;
    this._scene.load();
    this._scene.root.updateReady();
    this._state = 2 /* UPDATING */;
  }
  unLoad() {
  }
  update(time) {
    if (this._state === 2 /* UPDATING */) {
      this._scene.update(time);
    }
  }
  render(shader) {
    if (this._state === 2 /* UPDATING */) {
      this._scene.render(shader);
    }
  }
  onActivated() {
  }
  onDeactivated() {
  }
  loadSimObject(dataSection, parent) {
    let name;
    if (dataSection.name !== undefined) {
      name = String(dataSection.name);
    }
    this._globalID++;
    let simObject = new SimObject(this._globalID, name, this._scene);
    if (dataSection.transform !== undefined) {
      simObject.transform.setFromJson(dataSection.transform);
    }
    if (dataSection.components !== undefined) {
      for (let c in dataSection.components) {
        let data = dataSection.components[c];
        let component = ComponentManager.extractComponent(data);
        simObject.addComponent(component);
      }
    }
    if (dataSection.behaviors !== undefined) {
      console.warn("WARN: 'behaviors' found in JSON (American spelling). Did you mean 'behaviours'?");
    }
    if (dataSection.behaviours !== undefined) {
      for (let b in dataSection.behaviours) {
        let data = dataSection.behaviours[b];
        let behaviour = BehaviourManager.extractBehaviour(data);
        simObject.addBehavour(behaviour);
      }
    }
    if (dataSection.children !== undefined) {
      for (let ob in dataSection.children) {
        let obj = dataSection.children[ob];
        this.loadSimObject(obj, simObject);
      }
    }
    if (parent !== undefined) {
      parent.addChild(simObject);
    }
  }
}

// src/core/world/zoneManager.ts
class ZoneManager {
  static _globalZoneID = -1;
  static _registeredZones = {};
  static _activeZone;
  static _inst;
  constructor() {
  }
  static initialize() {
    ZoneManager._inst = new ZoneManager;
    ZoneManager._registeredZones[0] = "assets/zones/testZone.json";
  }
  static changeZone(id) {
    if (ZoneManager._activeZone) {
      ZoneManager._activeZone.onDeactivated();
      ZoneManager._activeZone.unLoad();
      ZoneManager._activeZone = undefined;
    }
    const zoneAssetPath = ZoneManager._registeredZones[id];
    if (!zoneAssetPath) {
      throw new Error(`ERROR: Zone ID '${id}' not registered`);
    }
    if (AssetManager.isAssetLoaded(zoneAssetPath)) {
      ZoneManager.loadZone(AssetManager.getAsset(zoneAssetPath));
    } else {
      Message2.subscribe(`${MESSAGE_ASSET_LOADER_ASSET_LOADED}${zoneAssetPath}`, ZoneManager._inst);
      AssetManager.loadAsset(zoneAssetPath);
    }
  }
  static update(time) {
    ZoneManager._activeZone?.update(time);
  }
  static render(shader) {
    ZoneManager._activeZone?.render(shader);
  }
  onMessage(message) {
    if (message.code.includes(MESSAGE_ASSET_LOADER_ASSET_LOADED)) {
      ZoneManager.loadZone(message.context);
    }
  }
  static loadZone(asset) {
    const { id, name, description } = this.validateZoneData(asset.data);
    ZoneManager._activeZone = new Zone(id, name, description ?? "");
    ZoneManager._activeZone.initialize(asset.data);
    ZoneManager._activeZone.onActivated();
    ZoneManager._activeZone.load();
    Message2.send("GAME_READY", this);
  }
  static validateZoneData(zoneData) {
    if (zoneData.id === undefined)
      throw new Error("ERROR: Missing zone ID");
    if (zoneData.name === undefined)
      throw new Error("ERROR: Missing zone name");
    return {
      id: Number(zoneData.id),
      name: String(zoneData.name),
      description: zoneData.description ? String(zoneData.description) : undefined
    };
  }
}

// src/core/gl/shaders.ts
class Shader {
  _name;
  _program;
  _attributes = {};
  _uniforms = {};
  constructor(name) {
    this._name = name;
  }
  get name() {
    return this._name;
  }
  use() {
    gl.useProgram(this._program);
  }
  getAttributeLocation(name) {
    if (this._attributes[name] === undefined) {
      throw new Error(`ERROR: Unable to find attribute named '${name}' in shader '${this._name}'`);
    }
    return this._attributes[name];
  }
  getUniformLocation(name) {
    if (this._uniforms[name] === undefined) {
      throw new Error(`ERROR: Unable to find uniform named '${name}' in shader '${this._name}'`);
    }
    return this._uniforms[name];
  }
  load(vertexSource, fragmentSource) {
    let vertexShader = this.loadShader(vertexSource, gl.VERTEX_SHADER);
    let fragmentShader = this.loadShader(fragmentSource, gl.FRAGMENT_SHADER);
    this.createProgram(vertexShader, fragmentShader);
    this.detectAttributes();
    this.detectUniforms();
  }
  loadShader(source, shaderType) {
    let shader = gl.createShader(shaderType);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    let error = gl.getShaderInfoLog(shader)?.trim();
    if (error !== "") {
      throw new Error("ERROR: Error compiling shader: '" + this._name + "': " + error);
    }
    return shader;
  }
  createProgram(vertexShader, fragmentShader) {
    this._program = gl.createProgram();
    gl.attachShader(this._program, vertexShader);
    gl.attachShader(this._program, fragmentShader);
    gl.linkProgram(this._program);
    let error = gl.getProgramInfoLog(this._program)?.trim();
    if (error !== "") {
      throw new Error("ERROR: Error linking shader: '" + this._name + "': " + error);
    }
  }
  detectAttributes() {
    let attributeCount = gl.getProgramParameter(this._program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0;i < attributeCount; i++) {
      let info = gl.getActiveAttrib(this._program, i);
      if (!info) {
        break;
      }
      this._attributes[info.name] = gl.getAttribLocation(this._program, info.name);
    }
  }
  detectUniforms() {
    let uniformCount = gl.getProgramParameter(this._program, gl.ACTIVE_UNIFORMS);
    for (let i = 0;i < uniformCount; ++i) {
      let info = gl.getActiveUniform(this._program, i);
      if (!info) {
        break;
      }
      this._uniforms[info.name] = gl.getUniformLocation(this._program, info.name);
    }
  }
}

// src/core/gl/shaders/basic.frag.ts
var fragmentShaderSource = `
precision mediump float;

uniform vec4 u_tint;

uniform sampler2D u_diffuse;

varying vec2 v_texCoord;

void main() {
    gl_FragColor = u_tint * texture2D(u_diffuse, v_texCoord);
}`;

// src/core/gl/shaders/basic.vert.ts
var vertexShaderSource = `
attribute vec3 a_position;

attribute vec2 a_texCoord;

uniform mat4 u_projection;

uniform mat4 u_model;

varying vec2 v_texCoord;

void main() {
    gl_Position = u_projection * u_model * vec4(a_position, 1.0);
    v_texCoord = a_texCoord;
}`;

// src/core/gl/shaders/basicShader.ts
class BasicShader extends Shader {
  constructor() {
    super("basic");
    this.load(this.getVertexSource(), this.getFragmentSource());
  }
  getVertexSource() {
    return vertexShaderSource;
  }
  getFragmentSource() {
    return fragmentShaderSource;
  }
}

// src/core/math/mathExtensions.ts
Math.clamp = (value, min, max) => {
  if (value < min)
    return min;
  if (value > max)
    return max;
  return value;
};
Math.degToRad = (degrees) => {
  return degrees * Math.PI / 180;
};
Math.radToDeg = (radians) => {
  return radians * 180 / Math.PI;
};

// src/core/behaviours/playerBehaviour.ts
class PlayerBehaviourData {
  name;
  acceleration = new Vector2(0, 920);
  playerCollisionComponent;
  groundCollisionComponent;
  animatedSpriteName;
  scoreCollisionComponent;
  setFromJson(json) {
    if (json.name === undefined) {
      throw new Error("ERROR: Name must be defined in behaviour data.");
    } else {
      this.name = String(json.name);
    }
    if (json.acceleration !== undefined) {
      this.acceleration.setFromJson(json.acceleration);
    }
    if (json.playerCollisionComponent === undefined) {
      throw new Error("ERROR: PlayerCollisionComponent must be defined in behaviour data.");
    } else {
      this.playerCollisionComponent = String(json.playerCollisionComponent);
    }
    if (json.groundCollisionComponent === undefined) {
      throw new Error("ERROR: GroundCollisionComponent must be defined in behaviour data.");
    } else {
      this.groundCollisionComponent = String(json.groundCollisionComponent);
    }
    if (json.animatedSpriteName === undefined) {
      throw new Error("ERROR: AnimatedSpriteName must be defined in behaviour data.");
    } else {
      this.animatedSpriteName = String(json.animatedSpriteName);
    }
    if (json.scoreCollisionComponent === undefined) {
      throw new Error("ERROR: 'scoreCollisionComponent' must be defined in behaviour data.");
    } else {
      this.scoreCollisionComponent = String(json.scoreCollisionComponent);
    }
  }
}

class PlayerBehaviourBuilder {
  get type() {
    return "player";
  }
  buildFromJson(json) {
    let data = new PlayerBehaviourData;
    data.setFromJson(json);
    return new PlayerBehaviour(data);
  }
}

class PlayerBehaviour extends BaseBehaviour {
  _acceleration;
  _velocity = Vector2.zero;
  _isAlive = true;
  _playerCollisionComponent;
  _groundCollisionComponent;
  _animatedSpriteName;
  _sprite;
  _isPlaying = false;
  _initialPosition = Vector3.zero;
  _pipeNames = [
    "pipe1Collision_end",
    "pipe1Collision_middle_top",
    "pipe1Collision_endneg",
    "pipe1Collision_middle_bottom"
  ];
  _scoreCollisionComponent;
  _score = 0;
  _highScore = 0;
  constructor(data) {
    super(data);
    this._acceleration = data.acceleration;
    this._playerCollisionComponent = data.playerCollisionComponent;
    this._groundCollisionComponent = data.groundCollisionComponent;
    this._animatedSpriteName = data.animatedSpriteName;
    this._scoreCollisionComponent = data.scoreCollisionComponent;
    Message2.subscribe("MOUSE_DOWN", this);
    Message2.subscribe("COLLISION_ENTRY", this);
    Message2.subscribe("GAME_READY", this);
    Message2.subscribe("GAME_RESET", this);
    Message2.subscribe("GAME_START", this);
    Message2.subscribe("PLAYER_DIED", this);
  }
  updateReady() {
    super.updateReady();
    this._sprite = this._owner.getComponentByName(this._animatedSpriteName);
    if (this._sprite === undefined) {
      throw new Error(`ERROR: AnimatedSpriteComponent: '${this._animatedSpriteName}', is not attached to the owner of this component.`);
    }
    this._sprite.setFrame(0);
    this._initialPosition.copyFrom(this._owner.transform.position);
  }
  update(time) {
    let seconds = time / 1000;
    if (this._isPlaying) {
      this._velocity.add(this._acceleration.clone().scale(seconds));
    }
    if (this._velocity.y > 400) {
      this._velocity.y = 400;
    }
    if (this._owner.transform.position.y < -13) {
      this._owner.transform.position.y = -13;
      this._velocity.y = 0;
    }
    this._owner.transform.position.add(this._velocity.clone().scale(seconds).toVector3());
    if (this._velocity.y < 0) {
      this._owner.transform.rotation.z -= Math.degToRad(600) * seconds;
      if (this._owner.transform.rotation.z < Math.degToRad(-20)) {
        this._owner.transform.rotation.z = Math.degToRad(-20);
      }
    }
    if (this.isFalling() || !this._isAlive) {
      this._owner.transform.rotation.z += Math.degToRad(480) * seconds;
      if (this._owner.transform.rotation.z > Math.degToRad(90)) {
        this._owner.transform.rotation.z = Math.degToRad(90);
      }
    }
    if (this.shouldNotFlap()) {
      this._sprite.stop();
    } else {
      if (!this._sprite.isPlaying) {
        this._sprite.play();
      }
    }
    super.update(time);
  }
  onMessage(message) {
    switch (message.code) {
      case "MOUSE_DOWN":
        this.onFlap();
        break;
      case "COLLISION_ENTRY":
        let data = message.context;
        if (data.a.name !== this._playerCollisionComponent && data.b.name !== this._playerCollisionComponent) {
          return;
        }
        if (data.a.name === this._groundCollisionComponent || data.b.name === this._groundCollisionComponent) {
          this.die();
          this.decelerate();
        } else if (this._pipeNames.indexOf(data.a.name) !== -1 || this._pipeNames.indexOf(data.b.name) !== -1) {
          this.die();
        } else if (data.a.name === this._scoreCollisionComponent || data.b.name === this._scoreCollisionComponent) {
          if (this._isAlive && this._isPlaying) {
            this.setScore(this._score + 1);
            AudioManager.playSound("ting");
          }
        }
        break;
      case "GAME_RESET":
        Message2.send("GAME_HIDE", this);
        Message2.send("RESET_HIDE", this);
        Message2.send("SPLASH_HIDE", this);
        Message2.send("TUTORIAL_SHOW", this);
        this.reset();
        break;
      case "GAME_START":
        Message2.send("GAME_SHOW", this);
        Message2.send("RESET_HIDE", this);
        Message2.send("SPLASH_HIDE", this);
        Message2.send("TUTORIAL_HIDE", this);
        this._isPlaying = true;
        this._isAlive = true;
        this.start();
        break;
      case "GAME_READY":
        Message2.send("RESET_HIDE", this);
        Message2.send("TUTORIAL_HIDE", this);
        Message2.send("GAME_HIDE", this);
        Message2.send("SPLASH_SHOW", this);
        break;
      case "PLAYER_DIED":
        Message2.send("RESET_SHOW", this);
        break;
    }
  }
  isFalling() {
    return this._velocity.y > 220;
  }
  shouldNotFlap() {
    return !this._isPlaying || this._velocity.y > 220 || !this._isAlive;
  }
  die() {
    if (this._isAlive) {
      this._isAlive = false;
      AudioManager.playSound("dead");
      Message2.send("PLAYER_DIED", this);
    }
  }
  reset() {
    this._isAlive = true;
    this._isPlaying = false;
    this._sprite.owner.transform.position.copyFrom(this._initialPosition);
    this._sprite.owner.transform.rotation.z = 0;
    this.setScore(0);
    this._velocity.set(0, 0);
    this._acceleration.set(0, 920);
    this._sprite.play();
  }
  start() {
    this._isPlaying = true;
    Message2.send("PLAYER_RESET", this);
  }
  decelerate() {
    this._acceleration.y = 0;
    this._velocity.y = 0;
  }
  onFlap() {
    if (this._isAlive && this._isPlaying) {
      this._velocity.y = -280;
      AudioManager.playSound("flap");
    }
  }
  setScore(score) {
    this._score = score;
    Message2.send("counterText:SetText", this, this._score);
    Message2.send("scoreText:SetText", this, this._score);
    if (this._score > this._highScore) {
      this._highScore = this._score;
      Message2.send("bestText:SetText", this, this._highScore);
    }
  }
}

// src/core/behaviours/scrollBehaviour.ts
class ScrollBehaviourData {
  name;
  velocity = Vector2.zero;
  minPosition = Vector2.zero;
  resetPosition = Vector2.zero;
  startMessage;
  stopMessage;
  resetMessage;
  minResetY;
  maxResetY;
  setFromJson(json) {
    if (json.name === undefined) {
      throw new Error("ERROR: 'Name' must be defined in behaviour data.");
    } else {
      this.name = String(json.name);
    }
    if (json.startMessage !== undefined) {
      this.startMessage = String(json.startMessage);
    }
    if (json.stopMessage !== undefined) {
      this.stopMessage = String(json.stopMessage);
    }
    if (json.resetMessage !== undefined) {
      this.resetMessage = String(json.resetMessage);
    }
    if (json.velocity !== undefined) {
      this.velocity.setFromJson(json.velocity);
    } else {
      throw new Error("ERROR: ScrollBehaviourData requires property 'velocity' to be defined!");
    }
    if (json.minPosition !== undefined) {
      this.minPosition.setFromJson(json.minPosition);
    } else {
      throw new Error("ERROR: ScrollBehaviourData requires property 'minPosition' to be defined!");
    }
    if (json.resetPosition !== undefined) {
      this.resetPosition.setFromJson(json.resetPosition);
    } else {
      throw new Error("ERROR: ScrollBehaviourData requires property 'resetPosition' to be defined!");
    }
    if (json.minResetY !== undefined) {
      this.minResetY = Number(json.minResetY);
    }
    if (json.maxResetY !== undefined) {
      this.maxResetY = Number(json.maxResetY);
    }
  }
}

class ScrollBehaviourBuilder {
  get type() {
    return "scroll";
  }
  buildFromJson(json) {
    let data = new ScrollBehaviourData;
    data.setFromJson(json);
    return new ScrollBehaviour(data);
  }
}

class ScrollBehaviour extends BaseBehaviour {
  _velocity = Vector2.zero;
  _minPosition = Vector2.zero;
  _resetPosition = Vector2.zero;
  _startMessage;
  _stopMessage;
  _resetMessage;
  _isScrolling = false;
  _initialPosition = Vector2.zero;
  _minResetY;
  _maxResetY;
  constructor(data) {
    super(data);
    this._velocity.copyFrom(data.velocity);
    this._minPosition.copyFrom(data.minPosition);
    this._resetPosition.copyFrom(data.resetPosition);
    this._startMessage = data.startMessage;
    this._stopMessage = data.stopMessage;
    this._resetMessage = data.resetMessage;
    if (data.minResetY !== undefined) {
      this._minResetY = data.minResetY;
    }
    if (data.maxResetY !== undefined) {
      this._maxResetY = data.maxResetY;
    }
  }
  updateReady() {
    super.updateReady();
    if (this._startMessage !== undefined) {
      Message2.subscribe(this._startMessage, this);
    }
    if (this._stopMessage !== undefined) {
      Message2.subscribe(this._stopMessage, this);
    }
    if (this._resetMessage !== undefined) {
      Message2.subscribe(this._resetMessage, this);
    }
    this._initialPosition.copyFrom(this._owner.transform.position.toVector2());
  }
  update(time) {
    if (this._isScrolling) {
      this._owner.transform.position.add(this._velocity.clone().scale(time / 1000).toVector3());
      let scrollY = this._minResetY !== undefined && this._maxResetY !== undefined;
      if (this._owner.transform.position.x <= this._minPosition.x && (scrollY || !scrollY && this._owner.transform.position.y <= this._minPosition.y)) {
        this.reset();
      }
    }
  }
  onMessage(message) {
    if (message.code === this._startMessage) {
      this._isScrolling = true;
    } else if (message.code === this._stopMessage) {
      this._isScrolling = false;
    } else if (message.code === this._resetMessage) {
      this.initial();
    }
  }
  reset() {
    if (this._minResetY !== undefined && this._maxResetY !== undefined) {
      this._owner.transform.position.set(this._resetPosition.x, this.getRandomY());
    } else {
      this._owner.transform.position.copyFrom(this._resetPosition.toVector3());
    }
  }
  getRandomY() {
    return Math.floor(Math.random() * (this._maxResetY - this._minResetY + 1)) + this._minResetY;
  }
  initial() {
    this._owner.transform.position.copyFrom(this._initialPosition.toVector3());
  }
}

// src/core/graphics/bitmaps/bitMapFont.ts
class FontUtilities {
  static extractFieldValue(field) {
    return field.split("=")[1];
  }
}

class FontGlyph {
  id;
  x;
  y;
  width;
  height;
  xOffset;
  yOffset;
  xAdvance;
  page;
  channel;
  static fromFields(fields) {
    let glyph = new FontGlyph;
    glyph.id = Number(FontUtilities.extractFieldValue(fields[1]));
    glyph.x = Number(FontUtilities.extractFieldValue(fields[2]));
    glyph.y = Number(FontUtilities.extractFieldValue(fields[3]));
    glyph.width = Number(FontUtilities.extractFieldValue(fields[4]));
    glyph.height = Number(FontUtilities.extractFieldValue(fields[5]));
    glyph.xOffset = Number(FontUtilities.extractFieldValue(fields[6]));
    glyph.yOffset = Number(FontUtilities.extractFieldValue(fields[7]));
    glyph.xAdvance = Number(FontUtilities.extractFieldValue(fields[8]));
    glyph.page = Number(FontUtilities.extractFieldValue(fields[9]));
    glyph.channel = Number(FontUtilities.extractFieldValue(fields[10]));
    return glyph;
  }
}

class BitmapFont {
  _name;
  _fontFileName;
  _assetLoaded = false;
  _imageFile;
  _glyphs = {};
  _size;
  _imageWidth;
  _imageHeight;
  constructor(name, fontFile) {
    this._name = name;
    this._fontFileName = fontFile;
  }
  get name() {
    return this._name;
  }
  get size() {
    return this._size;
  }
  get imageWidth() {
    return this._imageWidth;
  }
  get imageHeight() {
    return this._imageHeight;
  }
  get textureName() {
    return this._imageFile;
  }
  get isLoaded() {
    return this._assetLoaded;
  }
  load() {
    let asset = AssetManager.getAsset(this._fontFileName);
    if (asset !== undefined) {
      this.processFontFile(asset.data);
    } else {
      Message2.subscribe(MESSAGE_ASSET_LOADER_ASSET_LOADED + this._fontFileName, this);
    }
  }
  onMessage(message) {
    if (message.code === MESSAGE_ASSET_LOADER_ASSET_LOADED + this._fontFileName) {
      this.processFontFile(message.context.data);
    }
  }
  getGlyph(char) {
    let code = char.charCodeAt(0);
    code = this._glyphs[code] === undefined ? 63 : code;
    return this._glyphs[code];
  }
  measureText(text) {
    let size = Vector2.zero;
    let maxX = 0;
    let x = 0;
    let y = 0;
    for (let c of text) {
      switch (c) {
        case `
`:
          if (x > maxX) {
            maxX = x;
          }
          x = 0;
          y += this._size;
          break;
        default:
          x += this.getGlyph(c).xAdvance;
          break;
      }
    }
    size.set(maxX, y);
    return size;
  }
  processFontFile(content) {
    let charCount = 0;
    let lines = content.split(`
`);
    for (let line of lines) {
      let data = line.replace(/\s\s+/g, " ");
      let fields = data.split(" ");
      switch (fields[0]) {
        case "info":
          this._size = Number(FontUtilities.extractFieldValue(fields[2]));
          break;
        case "common":
          this._imageWidth = Number(FontUtilities.extractFieldValue(fields[3]));
          this._imageHeight = Number(FontUtilities.extractFieldValue(fields[4]));
          break;
        case "page":
          {
            let id = Number(FontUtilities.extractFieldValue(fields[1]));
            this._imageFile = FontUtilities.extractFieldValue(fields[2]);
            this._imageFile = this._imageFile.replace(/"/g, "");
            this._imageFile = ("assets/fonts/" + this._imageFile).trim();
          }
          break;
        case "chars":
          charCount = Number(FontUtilities.extractFieldValue(fields[1]));
          charCount++;
          break;
        case "char":
          {
            let glyph = FontGlyph.fromFields(fields);
            this._glyphs[glyph.id] = glyph;
          }
          break;
      }
    }
    let actualGlyphCount = 0;
    let keys = Object.keys(this._glyphs);
    for (let key of keys) {
      if (this._glyphs.hasOwnProperty(key)) {
        actualGlyphCount++;
      }
    }
    if (actualGlyphCount !== charCount) {
      throw new Error(`ERROR: Font file reported existence of ${charCount} glyphs, but only ${actualGlyphCount} were found.`);
    }
    this._assetLoaded = true;
  }
}

// src/core/graphics/bitmaps/bitMapFontManager.ts
class BitmapFontManager {
  static _fonts = {};
  static addFont(name, fontFileName) {
    BitmapFontManager._fonts[name] = new BitmapFont(name, fontFileName);
  }
  static getFont(name) {
    if (BitmapFontManager._fonts[name] === undefined) {
      throw new Error("ERROR: A font named " + name + " does not exist.");
    }
    return BitmapFontManager._fonts[name];
  }
  static load() {
    let keys = Object.keys(BitmapFontManager._fonts);
    for (let key of keys) {
      BitmapFontManager._fonts[key].load();
    }
  }
  static updateReady() {
    let keys = Object.keys(BitmapFontManager._fonts);
    for (let key of keys) {
      if (!BitmapFontManager._fonts[key].isLoaded) {
        console.info("INFO: Font " + key + " is still loading...");
        return false;
      }
    }
    console.info("LOG: All fonts are loaded");
    return true;
  }
}

// src/core/graphics/bitmaps/bitMapText.ts
class BitmapText {
  _fontName;
  _isDirty = false;
  _name;
  _origin = Vector3.zero;
  _buffer;
  _material;
  _bitmapFont;
  _vertices = [];
  _text;
  constructor(name, fontName) {
    this._name = name;
    this._fontName = fontName;
  }
  get name() {
    return this._name;
  }
  get text() {
    return this._text;
  }
  set text(value) {
    if (this._text !== value) {
      this._text = value;
      this._isDirty = true;
    }
  }
  get origin() {
    return this._origin;
  }
  set origin(value) {
    this._origin = value;
    this.calculateVertices();
  }
  destroy() {
    this._buffer.destroy();
    this._material.destroy();
    this._material = undefined;
  }
  load() {
    this._bitmapFont = BitmapFontManager.getFont(this._fontName);
    this._material = new Material(`BITMAP_FONT_${this.name}_${this._bitmapFont.size}`, this._bitmapFont.textureName, Color.white());
    this._buffer = new GLBuffer;
    let positionAttribute = new AttributeInfo;
    positionAttribute.location = 0;
    positionAttribute.size = 3;
    this._buffer.addAttributeLocation(positionAttribute);
    let texCoordAttribute = new AttributeInfo;
    texCoordAttribute.location = 1;
    texCoordAttribute.size = 2;
    this._buffer.addAttributeLocation(texCoordAttribute);
  }
  update(time) {
    if (this._isDirty && this._bitmapFont.isLoaded) {
      this.calculateVertices();
      this._isDirty = false;
    }
  }
  draw(shader, model) {
    let modelLocation = shader.getUniformLocation("u_model");
    gl.uniformMatrix4fv(modelLocation, false, model.toFloat32Array());
    let colorLocation = shader.getUniformLocation("u_tint");
    gl.uniform4fv(colorLocation, this._material.tint.toFloat32Array());
    if (this._material.diffuseTexture !== undefined) {
      this._material.diffuseTexture.activateAndBind(0);
      let diffuseLocation = shader.getUniformLocation("u_diffuse");
      gl.uniform1i(diffuseLocation, 0);
    }
    this._buffer.bind();
    this._buffer.draw();
  }
  calculateVertices() {
    this._vertices.length = 0;
    this._buffer.clearData();
    let x = 0;
    let y = 0;
    for (let c of this._text) {
      if (c === `
`) {
        x = 0;
        y += this._bitmapFont.size;
        continue;
      }
      let g = this._bitmapFont.getGlyph(c);
      let minX = x + g.xOffset;
      let minY = y + g.yOffset;
      let maxX = minX + g.width;
      let maxY = minY + g.height;
      let minu = g.x / this._bitmapFont.imageWidth;
      let minv = g.y / this._bitmapFont.imageHeight;
      let maxu = (g.x + g.width) / this._bitmapFont.imageWidth;
      let maxv = (g.y + g.height) / this._bitmapFont.imageHeight;
      this._vertices.push(new Vertex(minX, minY, 0, minu, minv));
      this._vertices.push(new Vertex(minX, maxY, 0, minu, maxv));
      this._vertices.push(new Vertex(maxX, maxY, 0, maxu, maxv));
      this._vertices.push(new Vertex(maxX, maxY, 0, maxu, maxv));
      this._vertices.push(new Vertex(maxX, minY, 0, maxu, minv));
      this._vertices.push(new Vertex(minX, minY, 0, minu, minv));
      x += g.xAdvance;
    }
    for (let v of this._vertices) {
      this._buffer.pushBackData(v.toArray());
    }
    this._buffer.upload();
    this._buffer.unbind();
  }
}

// src/core/components/bitMapTextComponent.ts
class BitmapTextComponentData {
  name;
  fontName;
  origin = Vector3.zero;
  text;
  setFromJson(json) {
    if (json.name !== undefined) {
      this.name = String(json.name);
    }
    if (json.fontName !== undefined) {
      this.fontName = String(json.fontName);
    }
    if (json.text !== undefined) {
      this.text = String(json.text);
    }
    if (json.origin !== undefined) {
      this.origin.setFromJson(json.origin);
    }
  }
}

class BitmapTextComponentBuilder {
  get type() {
    return "bitmapText";
  }
  buildFromJson(json) {
    let data = new BitmapTextComponentData;
    data.setFromJson(json);
    return new BitmapTextComponent(data);
  }
}

class BitmapTextComponent extends BaseComponent {
  _bitmapText;
  _fontName;
  constructor(data) {
    super(data);
    this._fontName = data.fontName;
    this._bitmapText = new BitmapText(this.name, this._fontName);
    if (!data.origin.equals(Vector3.zero)) {
      this._bitmapText.origin.copyFrom(data.origin);
    }
    this._bitmapText.text = data.text;
    Message2.subscribe(this.name + ":SetText", this);
  }
  load() {
    this._bitmapText.load();
  }
  update(time) {
    this._bitmapText.update(time);
  }
  render(shader) {
    this._bitmapText.draw(shader, this.owner.worldMatrix);
    super.render(shader);
  }
  onMessage(message) {
    if (message.code === this.name + ":SetText") {
      this._bitmapText.text = String(message.context);
    }
  }
}

// src/core/behaviours/mouseClickBehaviourData.ts
class MouseClickBehaviourData {
  name;
  width;
  height;
  messageCode;
  setFromJson(json) {
    if (json.name === undefined) {
      throw new Error("ERROR: 'name' must be defined in behaviour data.");
    } else {
      this.name = String(json.name);
    }
    if (json.width === undefined) {
      throw new Error("ERROR: 'width' must be defined in behaviour data.");
    } else {
      this.width = Number(json.width);
    }
    if (json.height === undefined) {
      throw new Error("ERROR: 'height' must be defined in behaviour data.");
    } else {
      this.height = Number(json.height);
    }
    if (json.messageCode === undefined) {
      throw new Error("ERROR: 'messageCode' must be defined in behaviour data.");
    } else {
      this.messageCode = String(json.messageCode);
    }
  }
}

class MouseClickBehaviourBuilder {
  get type() {
    return "mouseClick";
  }
  buildFromJson(json) {
    let data = new MouseClickBehaviourData;
    data.setFromJson(json);
    return new MouseClickBehaviour(data);
  }
}

class MouseClickBehaviour extends BaseBehaviour {
  _width;
  _height;
  _messageCode;
  constructor(data) {
    super(data);
    this._width = data.width;
    this._height = data.height;
    this._messageCode = data.messageCode;
    Message2.subscribe("MOUSE_UP", this);
  }
  onMessage(message) {
    if (message.code === "MOUSE_UP") {
      if (!this._owner.isVisible) {
        return;
      }
      let context = message.context;
      let worldPos = this._owner.getWorldPosition();
      let extentsX = worldPos.x + this._width;
      let extentsY = worldPos.y + this._height;
      if (context.position.x >= worldPos.x && context.position.x <= extentsX && context.position.y >= worldPos.y && context.position.y <= extentsY) {
        Message2.send(this._messageCode, this);
      }
    }
  }
}

// src/core/behaviours/visibilityOnMessageBehaviour.ts
class VisibilityOnMessageBehaviourData {
  name;
  messageCode;
  visible;
  setFromJson(json) {
    if (json.messageCode === undefined) {
      throw new Error("ERROR: VisibilityOnMessageBehaviourData requires 'messageCode' to be defined.");
    } else {
      this.messageCode = String(json.messageCode);
    }
    if (json.visible === undefined) {
      throw new Error("ERROR: VisibilityOnMessageBehaviourData requires 'visible' to be defined.");
    } else {
      this.visible = Boolean(json.visible);
    }
  }
}

class VisibilityOnMessageBehaviourBuilder {
  get type() {
    return "visibilityOnMessage";
  }
  buildFromJson(json) {
    let data = new VisibilityOnMessageBehaviourData;
    data.setFromJson(json);
    return new VisibilityOnMessageBehaviour(data);
  }
}

class VisibilityOnMessageBehaviour extends BaseBehaviour {
  _messageCode;
  _visible;
  constructor(data) {
    super(data);
    this._messageCode = data.messageCode;
    this._visible = data.visible;
    Message2.subscribe(this._messageCode, this);
  }
  onMessage(message) {
    if (message.code === this._messageCode) {
      this._owner.isVisible = this._visible;
    }
  }
}

// src/core/engine.ts
class KoruTSEngine {
  _canvas;
  _basicShader;
  _previousTime = 0;
  _gameWidth;
  _gameHeight;
  _projection;
  _isFirstUpdate = true;
  _aspect;
  constructor(width, height) {
    this._gameHeight = height;
    this._gameWidth = width;
  }
  start(elementName) {
    this._canvas = GLUtilities.initialize(elementName);
    if (this._gameWidth !== undefined && this._gameHeight !== undefined) {
      this._aspect = this._gameWidth / this._gameHeight;
    }
    AssetManager.initialize();
    InputManager.initialize(this._canvas);
    ZoneManager.initialize();
    BitmapFontManager.addFont("default", "assets/fonts/text.txt");
    BitmapFontManager.load();
    ComponentManager.registerBuilder(new SpriteComponentBuilder);
    ComponentManager.registerBuilder(new AnimatedSpriteComponentBuilder);
    ComponentManager.registerBuilder(new CollisionComponentBuilder);
    ComponentManager.registerBuilder(new BitmapTextComponentBuilder);
    BehaviourManager.registerBuilder(new RotationBehaviourBuilder);
    BehaviourManager.registerBuilder(new KeyboardMovementBehaviourBuilder);
    BehaviourManager.registerBuilder(new PlayerBehaviourBuilder);
    BehaviourManager.registerBuilder(new ScrollBehaviourBuilder);
    BehaviourManager.registerBuilder(new MouseClickBehaviourBuilder);
    BehaviourManager.registerBuilder(new VisibilityOnMessageBehaviourBuilder);
    gl.clearColor(146 / 255, 206 / 255, 247 / 255, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this._basicShader = new BasicShader;
    this._basicShader.use();
    MaterialManager.registerMaterial(new Material("bg", "assets/textures/bg.png", Color.white()));
    MaterialManager.registerMaterial(new Material("end", "assets/textures/end.png", Color.white()));
    MaterialManager.registerMaterial(new Material("middle", "assets/textures/middle.png", Color.white()));
    MaterialManager.registerMaterial(new Material("grass", "assets/textures/grass.png", Color.white()));
    MaterialManager.registerMaterial(new Material("duck", "assets/textures/duck.png", Color.white()));
    MaterialManager.registerMaterial(new Material("playbtn", "assets/textures/playbtn.png", Color.white()));
    MaterialManager.registerMaterial(new Material("restartbtn", "assets/textures/restartbtn.png", Color.white()));
    MaterialManager.registerMaterial(new Material("score", "assets/textures/score.png", Color.white()));
    MaterialManager.registerMaterial(new Material("title", "assets/textures/title.png", Color.white()));
    MaterialManager.registerMaterial(new Material("tutorial", "assets/textures/tutorial.png", Color.white()));
    AudioManager.loadSoundFile("flap", "assets/sounds/flap.mp3", false);
    AudioManager.loadSoundFile("ting", "assets/sounds/ting.mp3", false);
    AudioManager.loadSoundFile("dead", "assets/sounds/dead.mp3", false);
    this._projection = Matrix4x4.orthographic(0, this._canvas.width, this._canvas.height, 0, -100, 100);
    this.resize();
    this.preLoading();
  }
  onMessage(message) {
    if (message.code === "MOUSE_UP") {
      let context = message.context;
      document.title = `Mouse Position: [${context.position.x}, ${context.position.y}]`;
    }
  }
  loop() {
    if (this._isFirstUpdate) {
    }
    this.update();
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }
  preLoading() {
    MessageBus.update(0);
    if (!BitmapFontManager.updateReady()) {
      requestAnimationFrame(this.preLoading.bind(this));
      return;
    }
    ZoneManager.changeZone(0);
    this.loop();
  }
  resize() {
    if (this._canvas !== undefined) {
      if (this._gameWidth === undefined || this._gameHeight === undefined) {
        this._canvas.width = window.innerWidth;
        this._canvas.height = window.innerHeight;
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        this._projection = Matrix4x4.orthographic(0, window.innerWidth, window.innerHeight, 0, -100, 100);
      } else {
        let newWidth = window.innerWidth;
        let newHeight = window.innerHeight;
        let newWidthToHeight = newWidth / newHeight;
        let gameArea = document.getElementById("gameArea");
        if (newWidthToHeight > this._aspect) {
          newWidth = newHeight * this._aspect;
          gameArea.style.height = newHeight + "px";
          gameArea.style.width = newWidth + "px";
        } else {
          newHeight = newWidth / this._aspect;
          gameArea.style.width = newWidth + "px";
          gameArea.style.height = newHeight + "px";
        }
        gameArea.style.marginTop = -newHeight / 2 + "px";
        gameArea.style.marginLeft = -newWidth / 2 + "px";
        this._canvas.width = newWidth;
        this._canvas.height = newHeight;
        gl.viewport(0, 0, newWidth, newHeight);
        this._projection = Matrix4x4.orthographic(0, this._gameWidth, this._gameHeight, 0, -100, 100);
        let resolutionScale = new Vector2(newWidth / this._gameWidth, newHeight / this._gameHeight);
        InputManager.setResolutionScale(resolutionScale);
      }
    }
  }
  update() {
    let delta = performance.now() - this._previousTime;
    MessageBus.update(delta);
    ZoneManager.update(delta);
    CollisionManager.update(delta);
    this._previousTime = performance.now();
  }
  render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    ZoneManager.render(this._basicShader);
    let projectionPosition = this._basicShader.getUniformLocation("u_projection");
    gl.uniformMatrix4fv(projectionPosition, false, new Float32Array(this._projection.data));
  }
}

// src/app.ts
var engine;
window.onload = function() {
  engine = new KoruTSEngine(320, 480);
  engine.start();
};
