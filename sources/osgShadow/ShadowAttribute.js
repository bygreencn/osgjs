define( [
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Texture',
    'osg/Uniform',
    'osg/Matrix',
    'osg/Vec3',
    'osg/Vec4',
    'osg/Map'
], function ( MACROUTILS, StateAttribute, Texture, Uniform, Matrix, Vec3, Vec4, Map ) {
    'use strict';


    /**
     * ShadowAttribute encapsulate Shadow Main State object
     * @class ShadowAttribute
     * @inherits StateAttribute
     */
    var ShadowAttribute = function ( light, algoType, bias, exponent0, exponent1, vsmEpsilon, pcfKernelSize, precision ) {
        StateAttribute.call( this );


        //this._lightNumber // (might be broken by light reordering change) // yeah agree

        // just in case
        // the objetc in case of chage in ordering ?
        // need to be able to link in compiler the light uniforms as we use light uniforms in shadow shader code
        // well it's not supposed to be a problem, but yeah the ordering is an issue, so maybe it's better to link to
        // the light attribute, in this case we dont need anymore the _lightNumber
        // but re ordering light seems to not be a good practice in osg, it's still a risk
        this._light = light;
        // that could be more generic to have the unit instead of the object


        // hash change var
        this._algoType = algoType || 'NONE';

        // shadow depth bias as projected in shadow camera space texture
        // and viewer camera space projection introduce its bias
        this._bias = bias !== undefined ? bias : 0.001;
        // algo dependant
        // Exponential shadow maps use exponentials
        // to allows fuzzy depth
        this._exponent0 = exponent0 !== undefined ? exponent0 : 0.001;
        this._exponent1 = exponent1 !== undefined ? exponent1 : 0.001;
        // Variance Shadow mapping use One more epsilon
        this._vsmEpsilon = vsmEpsilon !== undefined ? vsmEpsilon : 0.001;
        // shader compilation differnet upon texture precision
        this._precision = precision !== undefined ? precision : 'BYTE';
        // kernel size & type for pcf
        this._pcfKernelSize = pcfKernelSize;


    };

    ShadowAttribute.uniforms = {};
    ShadowAttribute.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( StateAttribute.prototype, {

        attributeType: 'ShadowAttribute',

        cloneType: function () {
            return new ShadowAttribute();
        },

        getTypeMember: function () {
            return this.attributeType + this.getLightNumber();
        },
        getLightNumber: function () {
            return this.getLight() ? this.getLight().getLightNumber() : -1;
        },

        getUniformName: function ( name ) {
            var prefix = this.getType() + this.getLightNumber().toString();
            return prefix + '_uniform_' + name;
        },

        setAlgorithm: function ( algo ) {
            this._algoType = algo;
        },
        getAlgorithm: function () {
            return this._algoType;
        },

        setBias: function ( bias ) {
            this._bias = bias;
            //this.setDirty( true );
        },
        getBias: function () {
            return this._bias;
        },
        setExponent0: function ( exp ) {
            this._exponent0 = exp;
            //this.setDirty( true );
        },
        getExponent0: function () {
            return this._exponent0;
        },
        setExponent1: function ( exp ) {
            this._exponent1 = exp;
            //this.setDirty( true );
        },
        getExponent1: function () {
            return this._exponent1;
        },
        setVsmEpsilon: function ( vsmEpsilon ) {
            this._vsmEpsilon = vsmEpsilon;
            //this.setDirty( true );
        },
        getVsmEpsilon: function () {
            return this._vsmEpsilon;
        },
        getPCFKernelSize: function () {
            return this._pcfKernelSize;
        },
        setPCFKernelSize: function ( v ) {
            this._pcfKernelSize = v;
            //this.setDirty( true );
        },
        setPrecision: function ( precision ) {
            this._precision = precision;
            this.setDirty( true );
        },
        getPrecision: function () {
            return this._precision;
        },
        getLight: function () {
            return this._light;
        },

        getOrCreateUniforms: function () {
            // uniform are once per CLASS attribute, not per instance
            var obj = ShadowAttribute;

            var typeMember = this.getTypeMember();

            if ( obj.uniforms[ typeMember ] ) return obj.uniforms[ typeMember ];

            // Variance Shadow mapping use One more epsilon
            var uniformList = {
                'bias': 'createFloat',
                'exponent0': 'createFloat',
                'exponent1': 'createFloat',
                'vsmEpsilon': 'createFloat'
            };

            var uniforms = {};

            Object.keys( uniformList ).forEach( function ( key ) {

                var type = uniformList[ key ];
                var func = Uniform[ type ];
                uniforms[ key ] = func( this.getUniformName( key ) );

            }.bind( this ) );

            obj.uniforms[ typeMember ] = new Map( uniforms );

            return obj.uniforms[ typeMember ];
        },


        // Here to be common between  caster and receiver
        // (used by shadowMap and shadow node shader)
        getDefines: function () {

            var textureType = this.getPrecision();
            var algo = this.getAlgorithm();
            var defines = [];

            var isFloat = false;
            var isLinearFloat = false;

            if ( ( typeof textureType === 'string' && textureType !== 'BYTE' ) || textureType !== Texture.UNSIGNED_BYTE ) {
                isFloat = true;
            }

            if ( isFloat && ( ( typeof textureType === 'string' && textureType.indexOf( 'LINEAR' ) !== -1 ) || textureType === Texture.HALF_FLOAT_LINEAR || textureType === Texture.FLOAT_LINEAR ) ) {
                isLinearFloat = true;
            }


            if ( algo === 'ESM' ) {
                defines.push( '#define _ESM' );
            } else if ( algo === 'NONE' ) {
                defines.push( '#define _NONE' );
            } else if ( algo === 'PCF' ) {
                defines.push( '#define _PCF' );
                var pcf = this.getPCFKernelSize();
                switch ( pcf ) {
                case '16Band':
                    defines.push( '#define _PCF_BAND' );
                    defines.push( '#define _PCFx16' );
                    break;
                case '9Tap':
                    defines.push( '#define _PCF_TAP' );
                    defines.push( '#define _PCFx9' );
                    break;
                case '16Tap':
                    defines.push( '#define _PCF_TAP' );
                    defines.push( '#define _PCFx25' );
                    break;
                default:
                case '4Tap':
                    defines.push( '#define _PCF_TAP' );
                    defines.push( '#define _PCFx4' );
                    break;
                }
            } else if ( algo === 'VSM' ) {
                defines.push( '#define _VSM' );
            } else if ( algo === 'EVSM' ) {
                defines.push( '#define _EVSM' );
            }

            if ( isFloat ) {
                defines.push( '#define  _FLOATTEX' );
            }
            if ( isLinearFloat ) {
                defines.push( '#define  _FLOATLINEAR' );
            }

            return defines;
        },

        apply: function ( /*state*/) {

            var uniformMap = this.getOrCreateUniforms();

            uniformMap.bias.set( this._bias );
            uniformMap.exponent0.set( this._exponent0 );
            uniformMap.exponent1.set( this._exponent1 );
            uniformMap.vsmEpsilon.set( this._vsmEpsilon );

            this.setDirty( false );
        },

        getHash: function () {
            return this.getTypeMember() + this.getAlgorithm() + this.getPCFKernelSize();
        }

    } ), 'osgShadow', 'ShadowAttribute' );

    MACROUTILS.setTypeID( ShadowAttribute );

    return ShadowAttribute;
} );