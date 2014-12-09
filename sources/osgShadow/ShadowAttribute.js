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
    var ShadowAttribute = function ( light, algoType, bias, exponent0, exponent1, vsmEpsilon, precision ) {
        StateAttribute.call( this );


        //this._lightNumber // (might be broken by light reordering change) // yeah agree

        // just in case
        // the objetc in case of chage in ordering ?
        // need to be able to link in compiler the light uniforms as we use light uniforms in shadow shader code
        // well it's not supposed to be a problem, but yeah the ordering is an issue, so maybe it's better to link to
        // the light attribute, in this case we dont need anymore the _lightNumber
        // but re ordering light seems to not be a good practice in osg, it's still a risk
        this._light = light; // that could be more generic to have the unit instead of the object


        // hash change var
        this._algoType = algoType;

        // shadow depth bias as projected in shadow camera space texture
        // and viewer camera space projection introduce its bias
        this._bias = bias;
        // algo dependant
        // Exponential shadow maps use exponentials
        // to allows fuzzy depth
        this._exponent0 = exponent0;
        this._exponent1 = exponent1;
        // Variance Shadow mapping use One more epsilon
        this._VsmEpsilon = vsmEpsilon;
        // shader compilation differnet upon texture precision
        this._precision = precision;
    };

    ShadowAttribute.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( StateAttribute.prototype, {

        attributeType: 'ShadowAttribute',

        cloneType: function () {
            return new ShadowAttribute( this._light, this._algoType, this._bias, this._exponent0, this._exponent1, this._vsmEpsilon );
        },

        getTypeMember: function () {
            return this.attributeType + this._light.getLightNumber();
        },


        getUniformName: function ( name ) {
            var prefix = this.getType() + this._light.getLightNumber().toString();
            return prefix + '_uniform_' + name;
        },

        setAlgorithm: function ( algo ) {
            this._algoType = algo;
        },
        setBias: function ( bias ) {
            this._bias = bias;
        },
        setExponent0: function ( exp ) {
            this._exponent0 = exp;
        },
        setExponent1: function ( exp ) {
            this._exponent1 = exp;
        },
        setVsmEpsilon: function ( vsmEpsilon ) {
            this._vsmEpsilon = vsmEpsilon;
        },
        setPrecision: function ( precision ) {
            this._precision = precision;
        },
        getLight: function () {
            return this._light;
        },

        getOrCreateUniforms: function () {
            // Variance Shadow mapping use One more epsilon
            var uniformList = {
                'bias': 'createFloat',
                'exponent0': 'createMat',
                'exponent1': 'createFloat',
                'vsmEpsilon': 'createFloat'
            };

            var uniforms = {};

            Object.keys( uniformList ).forEach( function ( key ) {

                var type = uniformList[ key ];
                var func = Uniform[ type ];
                uniforms[ key ] = func( this.getUniformName( key ) );

            }.bind( this ) );

            this._uniforms = new Map( uniforms );

            return this._uniforms;
        },

        apply: function ( /*state*/) {

            var uniformMap = this.getOrCreateUniforms();

            uniformMap.ViewMatrix.set( this._viewMatrix );

            uniformMap.ProjectionMatrix.set( this._projectionMatrix );

            uniformMap.DepthRange.set( this._depthRange );

            // get that from texture size
            this._mapSize[ 0 ] = this._textureWidth;
            this._mapSize[ 1 ] = this._textureHeight;
            this._mapSize[ 3 ] = 1.0 / this._textureWidth;
            this._mapSize[ 4 ] = 1.0 / this._textureHeight;
            uniformMap.MapSize.set( this._mapSize );

            this.setDirty( false );
        },

        getHash: function () {
            return this.getTypeMember() + this.getAlgoType();
        }

    } ), 'osg', 'ShadowAttribute' );

    MACROUTILS.setTypeID( ShadowAttribute );

    return ShadowAttribute;
} );
