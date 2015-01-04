'use strict';
var CustomCompiler;
( function () {

    var osgShader = window.OSG.osgShader;
    var osg = window.OSG.osg;
    var factory = osgShader.nodeFactory;


    // this compiler use basic lighting and add a node to demonstrate how to
    // customize the shader compiler
    CustomCompiler = function () {
        osgShader.Compiler.apply( this, arguments );
    };


    CustomCompiler.prototype = osg.objectInherit( osgShader.Compiler.prototype, {


        // this is the main code that instanciate and link nodes together
        // it's a simplified version of the curent osgjs compiler
        // it could also be simpler
        createFragmentShaderGraph: function () {

            // no material then return a default shader
            // you could do whatever you want here
            // if you want to return a debug color
            // just to be sure that you always have
            // valid material in your scene, in our case we suppose
            // it exists in the scene
            // if ( !this._material )
            //     return this.createDefaultFragmentShaderGraph();

            var materialUniforms = this.getOrCreateStateAttributeUniforms( this._material );


            // that's the final result of the shader graph
            var fragColor = factory.getNode( 'FragColor' );


            // diffuse color
            // use texture if we have some, check code of Compiler
            // to see the default behaviour
            var diffuseColor = this.getDiffuseColorFromTextures();


            // no texture then we use the material diffuse value
            if ( diffuseColor === undefined ) {

                diffuseColor = materialUniforms.diffuse;

            } else {

                factory.getNode( 'InlineCode' ).code( '%color.rgb *= %diffuse.rgb;' ).inputs( {
                    diffuse: materialUniforms.diffuse
                } ).outputs( {
                    color: diffuseColor
                } );

            }

            var fragTempColor = this.createVariable( 'vec4' );
            if ( this._lights.length > 0 ) {

                // creates lights nodes
                var lightedOutput = this.createLighting( {
                    materialdiffuse: diffuseColor
                } );

                // get final color
                // use the rampResult from previous node
                factory.getNode( 'InlineCode' ).code( '%color = vec4(%emit.rgb + %lightedOutput, 1.0);' ).inputs( {
                    emit: materialUniforms.emission,
                    lightedOutput: lightedOutput
                } ).outputs( {
                    color: fragTempColor
                } );

            } else {

                // no lights use a default behaviour
                factory.getNode( 'InlineCode' ).code( '%color = vec4(%diffuse, 1.0);' ).inputs( {
                    diffuse: diffuseColor
                } ).outputs( {
                    color: fragTempColor
                } );
            }

            // ======================================================
            // my custom attribute temporal
            // it's here I connect ouput of light result with my temporal
            // ======================================================
            var temporalAttribute = this.getAttributeType( 'Temporal' );
            if ( temporalAttribute ) {
                var temporalResult = this.createVariable( 'vec4' );

                factory.getNode( 'Temporal' ).inputs( {
                    color: fragTempColor,
                    enable: this.getOrCreateUniform( temporalAttribute.getOrCreateUniforms().enable ),
                    frameNum: this.getOrCreateUniform( 'float', 'FrameNum' ),
                    fragScreenPos: this.getOrCreateVarying( 'vec4', 'FragScreenPos' ),
                    prevFragScreenPos: this.getOrCreateVarying( 'vec4', 'FragPrevScreenPos' ),
                    texture2: this.getOrCreateSampler( 'sampler2D', 'Texture2' )
                } ).outputs( {
                    color: temporalResult
                } );

                // no temporal use a default behaviour
                factory.getNode( 'InlineCode' ).code( '%color = %temporalResult;' ).inputs( {
                    temporalResult: temporalResult
                } ).outputs( {
                    color: fragColor
                } );

            } else {
                // no temporal use a default behaviour
                factory.getNode( 'InlineCode' ).code( '%color = %fragTempColor;' ).inputs( {
                    fragTempColor: fragTempColor
                } ).outputs( {
                    color: fragColor
                } );
            }
            // ======================================================

            return fragColor;
        },


        createVertexShaderGraph: function () {

            var texCoordMap = {};
            var textures = this._textures;
            var texturesMaterial = this._texturesByName;

            this._vertexShader.push( [ '',
                'attribute vec3 Vertex;',
                'attribute vec4 Color;',
                'attribute vec3 Normal;',
                'uniform float ArrayColorEnabled;',
                'uniform mat4 ModelViewMatrix;',
                'uniform mat4 ProjectionMatrix;',
                'uniform mat4 NormalMatrix;',
                'varying vec4 VertexColor;',
                'varying vec3 FragNormal;',
                'varying vec3 FragEyeVector;',
                '',
                ''
            ].join( '\n' ) );
            ////////////////////:
            var temporalAttribute = this.getAttributeType( 'Temporal' );
            if ( temporalAttribute ) {

                this._vertexShader.push( [ '',
                    'uniform mat4 PrevModelViewMatrix;',
                    'uniform mat4 PrevProjectionMatrix;',
                    '',
                    'uniform vec2 RenderSize;',
                    'uniform float SampleX;',
                    'uniform float SampleY;',
                    'uniform float FrameNum;',
                    'uniform int temporalEnable;',
                    '',
                    '// frame screenpos',
                    'varying vec4  FragScreenPos;',
                    '// previous frame screenpos',
                    'varying vec4  FragPrevScreenPos;',
                    '',
                ].join( '\n' ) );
                /////////////
            }

            for ( var t = 0, tl = textures.length; t < tl; t++ ) {

                var texture = textures[ t ];

                if ( texture !== undefined ) {

                    // no method to retrieve textureCoordUnit, we maybe dont need any uvs
                    var textureMaterial = texturesMaterial[ texture.getName() ];
                    if ( !textureMaterial && !textureMaterial.textureUnit )
                        continue;

                    var texCoordUnit = textureMaterial.textureUnit;
                    if ( texCoordUnit === undefined ) {
                        texCoordUnit = t; // = t;
                        textureMaterial.textureUnit = 0;
                    }

                    if ( texCoordMap[ texCoordUnit ] === undefined ) {

                        this._vertexShader.push( 'attribute vec2 TexCoord' + texCoordUnit + ';' );
                        this._vertexShader.push( 'varying vec2 FragTexCoord' + texCoordUnit + ';' );
                        texCoordMap[ texCoordUnit ] = true;

                    }

                }
            }
            this._vertexShader.push( [ '',
                'void main() {',
                ''
            ].join( '\n' ) );

            if ( temporalAttribute ) {

                this._vertexShader.push( [ '',
                    '  vec4 pos = ModelViewMatrix * vec4(Vertex,1.0);',
                    '  mat4 projMat = ProjectionMatrix;',
                    '  if (temporalEnable == 1 && FrameNum > 100.0){',
                    '    // original paper stretch to -1,1 but neighbour pixel will',
                    '    // overwrite over neighbour pixel',
                    '    // here it doesnt as it spreads over - 0.5 + 0.5 ',
                    '     projMat[2][0] += ((SampleX - 0.5) * 1.0) / (RenderSize.x );',
                    '     projMat[2][1] += ((SampleY - 0.5) * 1.0) / (RenderSize.y );',
                    '  }',
                    '  vec4 position = projMat * pos;',
                    '  gl_Position = position;',
                    '',
                    '  //projection space',
                    '  FragScreenPos = position;',
                    '',
                    '   // compute prev clip space position',
                    '  vec4 prevPos = PrevModelViewMatrix * vec4(Vertex,1.0);',
                    '  // get previous screen space position:',
                    '  vec4 prevPosition = PrevProjectionMatrix * prevPos;',
                    '  // projection space',
                    '  FragPrevScreenPos = prevPosition;',
                    ''
                ].join( '\n' ) );
                /////////////
            } else {
                this._vertexShader.push( [ '',
                    '  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);', '',
                    ''
                ].join( '\n' ) );
            }

            this._vertexShader.push( [ '',
                '  FragNormal = vec3(NormalMatrix * vec4(Normal, 0.0));',
                '  FragEyeVector = vec3(ModelViewMatrix * vec4(Vertex,1.0));',
                '  if (ArrayColorEnabled == 1.0)',
                '    VertexColor = Color;',
                '  else',
                '    VertexColor = vec4(1.0,1.0,1.0,1.0);',
                '  gl_PointSize = 1.0;',
                '',
                ''
            ].join( '\n' ) );

            var self = this;
            ( function () {
                var texCoordMap = {};

                for ( var tt = 0, ttl = textures.length; tt < ttl; tt++ ) {

                    if ( textures[ tt ] !== undefined ) {

                        var texture = textures[ tt ];
                        var textureMaterial = texturesMaterial[ texture.getName() ];

                        // no method getTexCoordUnit, maybe we dont need it at all
                        if ( !textureMaterial && !textureMaterial.textureUnit )
                            continue;

                        var texCoordUnit = texture.textureUnit;
                        if ( texCoordUnit === undefined ) {
                            texCoordUnit = tt;
                            textureMaterial.textureUnit = texCoordUnit;
                        }

                        if ( texCoordMap[ texCoordUnit ] === undefined ) {
                            self._vertexShader.push( 'FragTexCoord' + texCoordUnit + ' = TexCoord' + texCoordUnit + ';' );
                            texCoordMap[ texCoordUnit ] = true;
                        }
                    }
                }
            } )();




            this._vertexShader.push( '}' );
        },


    } );

} )();