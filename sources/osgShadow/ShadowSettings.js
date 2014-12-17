define( [
    'osg/Utils',
    'osg/Object',
    'osg/Texture'
], function ( MACROUTILS, Object, Texture ) {
    'use strict';
    /**
     *  ShadowSettings provides the parameters that the ShadowTechnique should use as a guide for setting up shadowing
     *  @class ShadowSettings
     */
    var ShadowSettings = function ( options ) {
        Object.call( this );

        this._receivesShadowTraversalMask = 0xffffffff;
        this._castsShadowTraversalMask = 0xffffffff;

        this._computeNearFearModeOverride = true;

        //this._light = undefined;
        this._baseShadowTextureUnit = 1;
        this._useShadowMapTextureOverride = true;
        this._textureSize = 1024;

        this._minimumShadowMapNearFarRatio = 0.05;
        this._maximumShadowMapDistance = Number.MAX_VALUE;
        //this._shadowMapProjectionHint = PERSPECTIVE_SHADOW_MAP;
        this._perspectiveShadowMapCutOffAngle = 2.0;

        this._numShadowMapsPerLight = 1;
        //this._multipleShadowMapHint = PARALLEL_SPLIT;

        //this._shaderHint = PROVIDE_FRAGMENT_SHADER;
        this._debugDraw = false;

        this._glContext = undefined;


        this._config = {
            'texturesize': 1024,
            'shadow': 'ESM',
            'texturetype': 'Force8bits',
            'lightnum': 1,
            'bias': 0.005,
            'VsmEpsilon': 0.0008,
            'supersample': 0,
            'blur': false,
            'blurKernelSize': 4.0,
            'blurTextureSize': 256,
            'model': 'ogre',
            'shadowstable': 'World Position',
            'shadowproj': 'fov',
            'fov': 50,
            'exponent': 40,
            'exponent1': 10.0,
        };
        this._textureType = 'BYTE';
        this._textureFormat = Texture.RGBA;
        this._textureFilterMin = Texture.NEAREST;
        this._textureFilterMax = Texture.NEAREST;
        this._algorithm = 'ESM';
        // if url options override url options
        MACROUTILS.objectMix( this._config, options );
    };

    /** @lends ShadowSettings.prototype */
    ShadowSettings.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Object.prototype, {


        setCastsShadowTraversalMask: function ( mask ) {
            this._castsShadowTraversalMask = mask;
        },
        getCastsShadowTraversalMask: function () {
            return this._castsShadowTraversalMask;
        },

        setComputeNearFarModeOverride: function ( cnfn ) {
            this._computeNearFearModeOverride = cnfn;
        },
        getComputeNearFarModeOverride: function () {
            return this._computeNearFearModeOverride;
        },

        setLight: function ( light ) {
            this._light = light;
        },
        getLight: function () {
            return this._light;
        },

        setBaseShadowTextureUnit: function ( unit ) {
            this._baseShadowTextureUnit = unit;
        },
        getBaseShadowTextureUnit: function () {
            return this._baseShadowTextureUnit;
        },

        /** Set whether to use osg::StateAttribute::OVERRIDE for the shadow map texture.
         * Enabling override will force the shadow map texture to override any texture set on the shadow maps texture unit.*/
        setUseOverrideForShadowMapTexture: function ( useOverride ) {
            this._useShadowMapTextureOverride = useOverride;
        },

        /** Get whether to use osg::StateAttribute::OVERRIDE for the shadow map texture. */
        getUseOverrideForShadowMapTexture: function () {
            return this._useShadowMapTextureOverride;
        },

        setTextureSize: function ( textureSize ) {
            this._textureSize = textureSize;
            this._dirty = true;
        },
        getTextureSize: function () {
            return this._textureSize;
        },
        setTextureType: function ( tt ) {
            this._textureType = tt;
            this._dirty = true;
        },
        getTextureType: function () {
            return this._textureType;
        },
        setTextureFilter: function ( tfMin, tfMax /* level af*/ ) {
            this._textureFilterMin = tfMin;
            this._textureFilterMax = tfMax;
            this._dirty = true;
        },
        getTextureFilterMax: function () {
            return this._textureFilterMax;
        },
        getTextureFilterMin: function () {
            return this._textureFilterMin;
        },
        setTextureFormat: function ( tf ) {
            this._textureFormat = tf;
        },
        getTextureFormat: function () {
            return this._textureFormat;
        },
		setAlgorithm: function (alg){
			this._algorithm = alg;
	  		this._dirty = true;
		},
		getAlgorithm: function (){
			return this._algorithm;
		},
        setMinimumShadowMapNearFarRatio: function ( ratio ) {
            this._minimumShadowMapNearFarRatio = ratio;
        
            this._dirty = true;
        },
        getMinimumShadowMapNearFarRatio: function () {
            return this._minimumShadowMapNearFarRatio;
        },

        setMaximumShadowMapDistance: function ( distance ) {
            this._maximumShadowMapDistance = distance;
        
            this._dirty = true;
        },
        getMaximumShadowMapDistance: function () {
            return this._maximumShadowMapDistance;
        },


        setShadowMapProjectionHint: function ( h ) {
            this._shadowMapProjectionHint = h;
            this._dirty = true;
        },
        getShadowMapProjectionHint: function () {
            return this._shadowMapProjectionHint;
        },


        /** Set the cut off angle, in degrees, between the light direction and the view direction
         * that determines whether perspective shadow mapping is appropriate, or thar orthographic shadow
         * map should be used instead.  Default is 2 degrees so that for any angle greater than 2 degrees
         * perspective shadow map will be used, and any angle less than 2 degrees orthographic shadow map
         * will be used.  Note, if ShadowMapProjectionH is set to ORTHOGRAPHICthis._SHADOWthis._MAP then an
         * orthographic shadow map will always be used.
         */
        setPerspectiveShadowMapCutOffAngle: function ( angle ) {
            this._perspectiveShadowMapCutOffAngle = angle;
            this._dirty = true;
        },
        getPerspectiveShadowMapCutOffAngle: function () {
            return this._perspectiveShadowMapCutOffAngle;
        },


        setNumShadowMapsPerLight: function ( numShadowMaps ) {
            this._numShadowMapsPerLight = numShadowMaps;
            this._dirty = true;
        },
        getNumShadowMapsPerLight: function () {
            return this._numShadowMapsPerLight;
        },


        setMultipleShadowMapHint: function ( h ) {
            this._multipleShadowMapHint = h;
            this._dirty = true;
        },
        getMultipleShadowMapHint: function () {
            return this._multipleShadowMapHint;
        },



        setShaderHint: function ( shaderHint ) {
            this._shaderHint = shaderHint;
            this._dirty = true;
        },
        getShaderHint: function () {
            return this._shaderHint;
        },

        setDebugDraw: function ( debugDraw ) {
            this._debugDraw = debugDraw;
            this._dirty = true;
        },
        getDebugDraw: function () {
            return this._debugDraw;
        },


        getConfig: function ( idx ) {
            return this._config[ idx ];
        }

    } ), 'osg', 'ShadowSettings' );
    MACROUTILS.setTypeID( ShadowSettings );

    return ShadowSettings;
} );