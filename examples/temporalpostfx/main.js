( function () {
    'use strict';

    window.OSG.globalify();

    var osg = window.osg;
    //var osgUtil = window.osgUtil;
    var osgViewer = window.osgViewer;
    var osgShader = window.osgShader;
    var $ = window.$;
    var Q = window.Q;
    var osgDB = window.osgDB;


    var CustomCompiler = window.CustomCompiler;
    var TemporalAttribute = window.TemporalAttribute;

    //http://www.ben-peck.com/articles/halton/
    // TODO: hammersley seems to have  better voronoi spread
    var halton = function ( index, base ) {
        var result = 0.0;
        var f = 1.0 / base;
        var i = index;
        while ( i > 0 ) {
            result = result + f * ( i % base );
            i = Math.floor( i / base );
            f = f / base;
        }

        return result;
    };


    var Example = function () {
        this._config = {};
    };



    Example.prototype = {


        addModel: function () {

            //var model = osg.createTexturedBoxGeometry( 0, 0, 0, 2, 2, 2 );
            var model = new osg.MatrixTransform();
            model.setName( 'ModelParent' );
            osg.Matrix.makeRotate( Math.PI, 0, 0, 1, model.getMatrix() );
            var modelName = '../ssao/raceship.osgjs';
            var request = osgDB.readNodeURL( modelName );

            //        var groundTex = osg.Texture.createFromURL( '../media/textures/seamless/bricks1.jpg' );
            //        groundTex.setWrapT( 'MIRRORED_REPEAT' );
            //        groundTex.setWrapS( 'MIRRORED_REPEAT' );

            // copy tex coord 0 to tex coord1 for multi texture
            request.then( function ( loadedModel ) {
                loadedModel.setName( 'model' );
                model.addChild( loadedModel );

                //          model.getOrCreateStateSet().setTextureAttributeAndModes( 0, groundTex );
            } );

            // add a node to animate the scene
            var rootModel = new osg.MatrixTransform();
            rootModel.setName( 'rootModel' );
            rootModel.addChild( model );

            rootModel._name = 'UPDATED MODEL NODE';
            return rootModel;
        },


        commonScene: function ( rttSize, order, rootModel, doFloat ) {

            var near = 0.1;
            var far = 100;

            var quadSize = [ 16 / 9, 1 ];

            // create the camera that render the scene
            var camera = new osg.Camera();
            camera.setName( 'scene' );
            camera.setProjectionMatrix( osg.Matrix.makePerspective( 50, quadSize[ 0 ], near, far, [] ) );
            camera.setViewMatrix( osg.Matrix.makeLookAt( [ 0, 10, 0 ], [ 0, 0, 0 ], [ 0, 0, 1 ], [] ) );
            camera.setRenderOrder( order, 0 );
            camera.setReferenceFrame( osg.Transform.ABSOLUTE_RF );
            camera.setViewport( new osg.Viewport( 0, 0, rttSize[ 0 ], rttSize[ 1 ] ) );
            camera.setClearColor( [ 0.5, 0.5, 0.5, 1 ] );

            // prevent projection matrix changes
            // after store in node
            camera.setComputeNearFar( false );

            // attach a texture to the camera to render the scene on
            var newSceneTexture = new osg.Texture();
            newSceneTexture.setTextureSize( rttSize[ 0 ], rttSize[ 1 ] );

            //newSceneTexture.setMinFilter( 'LINEAR' );
            //newSceneTexture.setMagFilter( 'LINEAR' );

            newSceneTexture.setMinFilter( 'NEAREST' );
            newSceneTexture.setMagFilter( 'NEAREST' );


            if ( doFloat ) {
                newSceneTexture.setType( osg.Texture.FLOAT );
                newSceneTexture.setInternalFormat( osg.Texture.RGBA );
            }
            camera.attachTexture( osg.FrameBufferObject.COLOR_ATTACHMENT0, newSceneTexture, 0 );
            camera.attachRenderBuffer( osg.FrameBufferObject.DEPTH_ATTACHMENT, osg.FrameBufferObject.DEPTH_COMPONENT16 );
            // add the scene to the camera
            camera.addChild( rootModel );


            // better view
            osg.Matrix.copy( [ 1.3408910815142607, 0, 0, 0, 0, 1.920982126971166, 0, 0, 0, 0, -1.002002002002002, -1, 0, 0, -2.002002002002002, 0 ], camera.getProjectionMatrix() );
            //osg.Matrix.copy( [ -1, 0, -0, 0, 0, 1, -0, 0, 0, -0, -1, 0, 0, 0, -50, 1 ], camera.getViewMatrix() );

            // better view
            osg.Matrix.copy( [ 0.9999999999999999, 3.979118659715591e-17, -1.2246467991473532e-16, 0, -1.2876698473377504e-16, 0.3090169943749474, -0.9510565162951535, 0, 0, 0.9510565162951536, 0.3090169943749474, 0, -2.465190328815662e-32, 0, -25.000000000000004, 1 ], camera.getViewMatrix() );

            // attach camera to root
            var newRoot = new osg.MatrixTransform();
            newRoot.setName( 'CameraRTTFather' );
            newRoot.addChild( camera );

            return [ newRoot, newSceneTexture, camera, rootModel ];
        },



        readShaders: function () {
            var defer = Q.defer();
            this._shaderProcessor = new osgShader.ShaderProcessor();

            var shaders = [
                'baseVert',
                'baseFrag',
                'diffFrag',
                'fxaa',
                'depthVert',
                'depthFrag',
                'reconstVert',
                'reconstFrag',
                'temporalAAVert',
                'temporalAAFrag',
                'temporalStaticAAVert',
                'temporalStaticAAFrag',
                'reprojvertex_node',
                'ssaa_node'
            ];

            var promises = [];
            var shadersLib = {};
            shaders.forEach( function ( shader ) {
                var promise = Q( $.get( 'shaders/' + shader + '.glsl?' + Math.random() ) );
                promise.then( function ( shaderText ) {
                    if ( shader && shaderText ) {
                        shadersLib[ shader ] = shaderText;
                    }
                } );
                promises.push( promise );
            } );

            var _self = this;
            Q.all( promises ).then( function () {
                _self._shaderProcessor.addShaders( shadersLib );
                defer.resolve();
            } );

            return defer.promise;
        },



        getShaderProgram: function ( vs, ps, defines, useCache ) {

            var hash;
            if ( useCache ) {
                hash = vs + ps + defines.join( '' );
                if ( !this._cache )
                    this._cache = {};

                if ( this._cache[ hash ] )
                    return this._cache[ hash ];
            }

            var vertexshader = this._shaderProcessor.getShader( vs, defines );
            var fragmentshader = this._shaderProcessor.getShader( ps, defines );

            var program = new osg.Program(
                new osg.Shader( 'VERTEX_SHADER', vertexshader ), new osg.Shader( 'FRAGMENT_SHADER', fragmentshader ) );

            if ( useCache ) {
                this._cache[ hash ] = program;
            }

            return program;
        },

        // show the shadowmap as ui quad on left bottom screen
        // in fact show all texture inside this._rtt
        showFrameBuffers: function ( optionalArgs ) {

            var _ComposerdebugNode = new osg.Node();
            _ComposerdebugNode.setName( 'debugComposerNode' );
            _ComposerdebugNode.setCullingActive( false );
            var _ComposerdebugCamera = new osg.Camera();
            _ComposerdebugCamera.setName( '_ComposerdebugCamera' );
            this._rttDebugNode.addChild( _ComposerdebugCamera );

            var optionsDebug = {
                x: 0,
                y: 100,
                w: 100,
                h: 80,
                horizontal: true,
                screenW: 1024,
                screenH: 768,
                fullscreen: false
            };
            if ( optionalArgs )
                osg.extend( optionsDebug, optionalArgs );

            var matrixDest = _ComposerdebugCamera.getProjectionMatrix();
            osg.Matrix.makeOrtho( 0, optionsDebug.screenW, 0, optionsDebug.screenH, -5, 5, matrixDest );
            _ComposerdebugCamera.setProjectionMatrix( matrixDest ); //not really needed until we do matrix caches

            matrixDest = _ComposerdebugCamera.getViewMatrix();
            osg.Matrix.makeTranslate( 0, 0, 0, matrixDest );
            _ComposerdebugCamera.setViewMatrix( matrixDest );
            _ComposerdebugCamera.setRenderOrder( osg.Camera.NESTED_RENDER, 0 );
            _ComposerdebugCamera.setReferenceFrame( osg.Transform.ABSOLUTE_RF );
            _ComposerdebugCamera.addChild( _ComposerdebugNode );

            var texture;
            var xOffset = optionsDebug.x;
            var yOffset = optionsDebug.y;
            _ComposerdebugNode.removeChildren();

            var stateset;
            var program = this.getShaderProgram( 'baseVert', 'baseFrag', [], true );
            stateset = _ComposerdebugNode.getOrCreateStateSet();
            if ( !optionsDebug.fullscreen )
                stateset.setAttributeAndModes( new osg.Depth( 'DISABLE' ) );
            stateset.setAttributeAndModes( program );
            for ( var i = 0, l = this._rtt.length; i < l; i++ ) {
                texture = this._rtt[ i ];
                if ( texture ) {
                    var quad = osg.createTexturedQuadGeometry( xOffset, yOffset, 0, optionsDebug.w, 0, 0, 0, optionsDebug.h, 0 );

                    stateset = quad.getOrCreateStateSet();

                    quad.setName( 'debugCompoGeom' );

                    stateset.setTextureAttributeAndModes( 0, texture );
                    stateset.setAttributeAndModes( program );
                    // stateset.setAttributeAndModes(new osg.Depth('DISABLE'));

                    _ComposerdebugNode.addChild( quad );

                    if ( optionsDebug.horizontal ) xOffset += optionsDebug.w + 2;
                    else yOffset += optionsDebug.h + 2;
                }
            }
        },

        updateDebugRtt: function () {
            // show the framebuffers as ui quad on left bottom screen
            if ( this._rttDebugNode ) {
                this._rttDebugNode.removeChildren();
            } else {
                this._rttDebugNode = new osg.Node();
                this._rttDebugNode.setName( '_rttDebugNode' );
            }
            this.showFrameBuffers( {
                screenW: this._canvas.width,
                screenH: this._canvas.height
            } );
        },

        updateStateSet: function ( effect ) {

            var st;
            if ( effect.getSceneProgram ) {

                st = this._cameraRTT.getOrCreateStateSet();

                st.setTextureAttributeAndModes( 2, this._sceneTexture2, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                st.addUniform( osg.Uniform.createInt1( 2, 'Texture2' ) );

                st = this._cameraRTT2.getOrCreateStateSet();

                st.setTextureAttributeAndModes( 2, this._sceneTexture, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                st.addUniform( osg.Uniform.createInt1( 2, 'Texture2' ) );

                this._temporalAttribute.setAttributeEnable( true );
            } else {
                this._cameraRTT.setStateSet( undefined );
                this._cameraRTT2.setStateSet( undefined );

                this._temporalAttribute.setAttributeEnable( false );
            }
        },

        setComposer: function ( effectName, textureScale ) {

            this.currentEffectName = effectName;

            // recreate the rtt
            //
            this._root.removeChild( this._commonNode );
            this._root.removeChild( this._commonNode2 );

            //if ( rttSize[ 0 ] !== width * textureScale || rttSize[ 1 ] !== height * textureScale ) {

            this._rttSize = [ this._width * textureScale, this._height * textureScale ];

            // new scene Textures
            //////////////////////////////
            // create First RTTed Scene for ping pong
            var result2 = this.commonScene( this._rttSize, osg.Camera.PRE_RENDER, this._model, false );
            this._commonNode2 = result2[ 0 ];
            this._sceneTexture2 = result2[ 1 ];
            this._cameraRTT2 = result2[ 2 ];

            //////////////////////////////////////////////
            // render Second RTTed Scene for ping pong
            var result = this.commonScene( this._rttSize, osg.Camera.PRE_RENDER, this._model, false );
            this._commonNode = result[ 0 ];
            this._sceneTexture = result[ 1 ];
            this._cameraRTT = result[ 2 ];

            this.updateStateSet( this._effects[ effectName ] );


            // new final Texture
            this._finalTexture = new osg.Texture();
            this._finalTexture.setTextureSize( this._rttSize[ 0 ], this._rttSize[ 1 ] );
            this._texW.set( this._rttSize[ 0 ] );
            this._texH.set( this._rttSize[ 1 ] );

            //finalTexture.setMinFilter( osg.Texture.LINEAR );
            //finalTexture.setMagFilter( osg.Texture.LINEAR );
            this._finalTexture.setMinFilter( 'NEAREST' );
            this._finalTexture.setMagFilter( 'NEAREST' );


            this._quad.getOrCreateStateSet().setTextureAttributeAndModes( 0, this._finalTexture );
            //}

            //
            //
            // Put the composer in cache at first utilization
            //if ( cachedComposers[ effectName ] === undefined ) {
            this._cachedComposers[ effectName ] = this._effects[ effectName ].buildComposer( this._sceneTexture, this._finalTexture, this._quad, this._scene );
            //}


            // Recreate the whole gui
            this._gui.destroy();
            this._gui = new dat.GUI();
            this.addSceneController();
            this._effects[ effectName ].buildGui( this._gui );

            // Change the composer
            this._scene.removeChild( this._currentComposer );
            this._currentComposer = this._cachedComposers[ effectName ];
            this._scene.addChild( this._currentComposer );

            if ( effectName.indexOf( 'static' ) !== -1 ) {
                if ( this._effects[ effectName ].needPreviousDepth ) {
                    this._root.addChild( this._commonNode2 );
                }
                if ( this._effects[ effectName ].needCommonCube ) {
                    this._root.addChild( this._commonNode );
                }
            } else {
                this._currentFrameSinceStop = 0;
                this._root.addChild( this._commonNode );
            }
            this._rtt = [];
            this._rtt.push( this._sceneTexture2 );
            this._rtt.push( this._sceneTexture );
            this._rtt.push( this._finalTexture );

            this.updateDebugRtt();

        },

        addSceneController: function () {
            var _self = this;

            this._gui.add( this._globalGui, 'filter', Object.keys( this._effects ) ).onChange( function ( value ) {
                this.setComposer( value, parseFloat( _self._globalGui.pixelRatio ) );
            } );

            this._gui.add( this._globalGui, 'diffMode', [ 'slide', 'diffScale', 'mix' ] ).onChange( function ( value ) {

                _self.slideUnif.set( -1.0 );
                _self.mixUnif.set( -1.0 );
                _self.diffUnif.set( -1.0 );
                switch ( value ) {
                case 'slide':
                    _self.slideUnif.set( _self._globalGui.factor );
                    break;
                case 'diffScale':
                    _self.diffUnif.set( _self._globalGui.factor );
                    break;
                case 'mix':
                    _self.mixUnif.set( _self._globalGui.factor );
                    break;

                }
            } );

            this._gui.add( this._globalGui, 'factor', 0.125, 3.0 ).onChange( function ( value ) {
                _self.slideUnif.set( -1.0 );
                _self.mixUnif.set( -1.0 );
                _self.diffUnif.set( -1.0 );
                switch ( _self._globalGui.diffMode ) {
                case 'slide':
                    _self.slideUnif.set( value );
                    break;
                case 'diffScale':
                    _self.diffUnif.set( value );
                    break;
                case 'mix':
                    _self.mixUnif.set( value );
                    break;
                }
            } );

            this._gui.add( this._globalGui, 'pixelRatio', 0.125, 3.0 ).onChange( function ( value ) {
                _self.factorRenderUnif.set( value );
                _self.setComposer( _self._globalGui.filter, parseFloat( value ) );
            } );

            this._gui.add( this._globalGui, 'animate' );
            this._gui.add( this._globalGui, 'reload' );
        },

        createScene: function () {

            this._rttSize = [ this._canvas.width, this._canvas.height ];
            // cannot add same model multiple in same grap
            // it would break previousframe matrix saves

            this._model = this.addModel(); // "current frame model" added twise if no model2

            //////////////////////////////
            // create First RTTed Scene for ping pong
            var result2 = this.commonScene( this._rttSize, osg.Camera.PRE_RENDER, this._model, false );
            this._commonNode2 = result2[ 0 ];
            this._sceneTexture2 = result2[ 1 ];
            this._cameraRTT2 = result2[ 2 ];

            //////////////////////////////////////////////
            // render Second RTTed Scene for ping pong
            var result = this.commonScene( this._rttSize, osg.Camera.PRE_RENDER, this._model, false );
            this._commonNode = result[ 0 ];
            this._sceneTexture = result[ 1 ];
            this._cameraRTT = result[ 2 ];

            this._root = new osg.Node();
            this._root.setName( 'rootcreateScene' );

            this.sampleXUnif = osg.Uniform.createFloat1( 0.0, 'SampleX' );
            this.sampleYUnif = osg.Uniform.createFloat1( 0.0, 'SampleY' );
            this.frameNumUnif = osg.Uniform.createFloat1( 0.0, 'FrameNum' );
            this.factorRenderUnif = osg.Uniform.createFloat1( 1.0, 'FactorRender' );

            this.diffUnif = osg.Uniform.createFloat1( -1.0, 'diffScale' );
            this.slideUnif = osg.Uniform.createFloat1( 0.5, 'slide' );
            this.mixUnif = osg.Uniform.createFloat1( -1.0, 'mixTex' );

            this._root.getOrCreateStateSet().addUniform( this.sampleXUnif );
            this._root.getOrCreateStateSet().addUniform( this.sampleYUnif );
            this._root.getOrCreateStateSet().addUniform( this.frameNumUnif );
            this._root.getOrCreateStateSet().addUniform( this.factorRenderUnif );


            this._texW = osg.Uniform.createFloat1( this._rttSize[ 0 ], 'tex_w' );
            this._texH = osg.Uniform.createFloat1( this._rttSize[ 1 ], 'tex_h' );

            this._root.getOrCreateStateSet().addUniform( this._texW );
            this._root.getOrCreateStateSet().addUniform( this._texH );


            // create a quad on main camera which will be applied the postprocess effects
            var quadSize = [ 16 / 9, 1 ];
            this._quad = osg.createTexturedQuadGeometry( -quadSize[ 0 ] / 2.0, 0, -quadSize[ 1 ] / 2.0,
                quadSize[ 0 ], 0, 0,
                0, 0, quadSize[ 1 ] );
            this._quad.getOrCreateStateSet().setAttributeAndModes( this.getShaderProgram( 'baseVert', 'diffFrag', [], true ) );
            this._quad.setName( 'TextureFinalTVDebug' );

            this.diffUnif = osg.Uniform.createFloat1( 0.0, 'diffScale' );
            this.slideUnif = osg.Uniform.createFloat1( 0.0, 'slide' );
            this.mixUnif = osg.Uniform.createFloat1( 0.0, 'mix' );

            this._quad.getOrCreateStateSet().addUniform( this.diffUnif );
            this._quad.getOrCreateStateSet().addUniform( this.mixUnif );
            this._quad.getOrCreateStateSet().addUniform( this.slideUnif );


            this._scene = new osg.MatrixTransform();
            this._scene.setName( 'sceneFinalTV' );

            // create a texture to render one of the ping pong texture
            this._finalTexture = new osg.Texture();
            this._finalTexture.setTextureSize( this._rttSize[ 0 ], this._rttSize[ 1 ] );

            // no filtering in order to get precise view.
            //finalTexture.setMinFilter( osg.Texture.LINEAR );
            //finalTexture.setMagFilter( osg.Texture.LINEAR );
            this._finalTexture.setMinFilter( 'NEAREST' );
            this._finalTexture.setMagFilter( 'NEAREST' );

            // Set the final texture on the quad
            this._quad.getOrCreateStateSet().setTextureAttributeAndModes( 0, this._finalTexture );




            this._postScenes = [
                getFxaa(),
                getSSAA()
            ];

            this._effects = [];
            for ( var i = 0; i < this._postScenes.length; i++ )
                this._effects[ this._postScenes[ i ].name ] = this._postScenes[ i ];

            var _self = this;
            this._globalGui = {
                'filter': _self._postScenes[ 0 ].name,
                'diffMode': 'slide',
                'pixelRatio': 1.0,
                'factor': 0.5,
                'animate': function () {
                    _self._doAnimate = !_self._doAnimate;
                    _self._currentFrameSinceStop = 0;
                },
                'reload': function () {
                    _self.readShaders().then( function () {
                        if ( console.clear ) console.clear();
                        _self.setComposer( _self._globalGui.filter, parseFloat( _self._globalGui.pixelRatio ) );

                        _self._currentFrameSinceStop = 0;
                    } );

                },

                'camera': function () {
                    this._viewer._manipulator._target = _self._model;

                }
            };


            this._currentCameraComposerEffect = this._cameraRTT;

            this.updateStateSet( this._postScenes[ 0 ] );

            this._currentComposer = this._postScenes[ 0 ].buildComposer( this._sceneTexture, this._finalTexture, this._quad, this._scene );
            this.addSceneController();
            this._postScenes[ 0 ].buildGui( this._gui );

            this._cachedComposers = [];
            this._cachedComposers[ this._postScenes[ 0 ].name ] = this._currentComposer;
            this._currentEffectName = this._postScenes[ 0 ].name;

            this._scene.addChild( this._quad );
            this._scene.addChild( this._currentComposer );


            this._rtt = [];
            this._rtt.push( this._sceneTexture2 );
            this._rtt.push( this._sceneTexture );
            this._rtt.push( this._finalTexture );
            this.updateDebugRtt();

            this._scene.addChild( this._rttDebugNode );


            this._root.addChild( this._scene );
            this._root.addChild( this._commonNode );
            this._root.addChild( this._commonNode2 );

            // update once a frame
            var UpdateCallback = function () {
                this.update = function ( node, nv ) {
                    _self._currentFrame++;
                    if ( _self._doAnimate ) {
                        _self._currentTime = nv.getFrameStamp().getSimulationTime();
                        var x = Math.cos( _self._currentTime );
                        osg.Matrix.makeRotate( x, 0, 0, 1, _self._model.getMatrix() );
                    }

                    if ( _self._currentEffectName.indexOf( 'SSAA' ) !== -1 ) {
                        _self._currentFrameSinceStop++;
                        if ( !_self._doAnimate ) {
                            var frameNum = _self.currentFrameSinceStop;

                            if ( frameNum >= 100 ) {
                                _self.sampleXUnif.set( halton( frameNum - 100, 2 ) );
                                _self.sampleYUnif.set( halton( frameNum - 100, 3 ) );
                            }
                            _self.frameNumUnif.set( frameNum );
                        }

                        // should be composer node switching,
                        // but it's a mess.
                        //var sceneTexture, sceneTexture2;

                        //currentCameraComposerEffect;
                        if ( _self._currentFrame % 2 === 0 ) {
                            if ( _self.root.hasChild( _self._commonNode ) ) _self.root.removeChild( _self._commonNode );
                            if ( !_self.root.hasChild( _self._commonNode2 ) ) _self.root.addChild( _self._commonNode2 );
                        } else {
                            if ( _self.root.hasChild( _self._commonNode2 ) ) _self.root.removeChild( _self._commonNode2 );
                            if ( !_self.root.hasChild( _self._commonNode ) ) _self.root.addChild( _self._commonNode );
                        }
                    }

                    // making sure here same proj/view
                    osg.Matrix.copy( _self._cameraRTT.getProjectionMatrix(), _self._cameraRTT2.getProjectionMatrix() );
                    osg.Matrix.copy( _self._cameraRTT.getViewMatrix(), _self._cameraRTT2.getViewMatrix() );
                    osg.Matrix.copy( _self._cameraRTT2.getProjectionMatrix(), _self._cameraRTT2.getProjectionMatrix() );
                    osg.Matrix.copy( _self._cameraRTT2.getViewMatrix(), _self._cameraRTT2.getViewMatrix() );

                    node.traverse( nv );
                };
            };
            this._root.setUpdateCallback( new UpdateCallback() );

            return this._root;
        },

        installCustomShaders: function () {

            // create a new shader generator with our own compiler
            var shaderGenerator = new osgShader.ShaderGenerator();
            shaderGenerator.setShaderCompiler( CustomCompiler );
            // make the ShaderGenerator accept new Attributes
            shaderGenerator.getAcceptAttributeTypes().add( 'Temporal' );

            // get or create instance of ShaderGeneratorProxy
            var shaderGeneratorProxy = this._viewer.getState().getShaderGeneratorProxy();
            shaderGeneratorProxy.addShaderGenerator( 'custom', shaderGenerator );

            this._temporalAttribute = new TemporalAttribute();
            this._temporalAttribute.setAttributeEnable( false );

        },

        run: function () {

            // osg.ReportWebGLError = true;
            this._canvas = document.getElementById( 'View' );
            this._canvas.style.width = this._canvas.width = window.innerWidth;
            this._canvas.style.height = this._canvas.height = window.innerHeight;

            this._gui = new dat.GUI();
            this._viewer = new osgViewer.Viewer( this._canvas );
            this._viewer.init();

            var _self = this;
            this.readShaders().then( function () {

                _self._viewer.getCamera().setClearColor( [ 0.0, 0.0, 0.0, 0.0 ] );


                _self.installCustomShaders();

                var rotate = new osg.MatrixTransform();
                rotate.addChild( _self.createScene() );
                rotate.getOrCreateStateSet().setAttributeAndModes( new osg.CullFace( 'DISABLE' ) );
                rotate.getOrCreateStateSet().setAttributeAndModes( _self._temporalAttribute, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );

                _self._viewer.setSceneData( rotate );

                /*
        visitor = new osgUtil.DisplayNodeGraphVisitor();
        rotate.accept( visitor );
        visitor.createGraph();
                 */

                _self._viewer.setupManipulator();

                _self._viewer.getManipulator().computeHomePosition();
                _self._viewer.run();
            } );
        }
    };


    window.addEventListener( 'load', function () {
        var example = new Example();
        example.run();
    }, true );

} )();