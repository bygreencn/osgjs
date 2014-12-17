
#define vec2_splat(_x) vec2(_x, _x)
#define vec3_splat(_x) vec3(_x, _x, _x)
#define vec4_splat(_x) vec4(_x, _x, _x, _x)
#define lerp(_x, _y, _s) (_x + _s*(_y-_x))
#define atan2(_x, _y) (atan(_y, _x))

float linearrgb_to_srgb1(const in float c) {
    float v = 0.0;
    if (c < 0.0031308) {
        if (c > 0.0)   v = c * 12.92;
    } else {
        v = 1.055 * pow(c, 1.0 / 2.4) - 0.055;
    }
    return v;
}
vec4 linearrgb_to_srgb(const in vec4 col_from) {
    vec4 col_to;
    col_to.r = linearrgb_to_srgb1(col_from.r);
    col_to.g = linearrgb_to_srgb1(col_from.g);
    col_to.b = linearrgb_to_srgb1(col_from.b);
    col_to.a = col_from.a;
    return col_to;
}
float srgb_to_linearrgb1(const in float c) {
    float v = 0.0;
    if (c < 0.04045) {
        if (c >= 0.0)   v = c * (1.0 / 12.92);
    } else {
        v = pow((c + 0.055) * (1.0 / 1.055), 2.4);
    }
    return v;
}
vec4 srgb2linear(const in vec4 col_from) {
    vec4 col_to;
    col_to.r = srgb_to_linearrgb1(col_from.r);
    col_to.g = srgb_to_linearrgb1(col_from.g);
    col_to.b = srgb_to_linearrgb1(col_from.b);
    col_to.a = col_from.a;
    return col_to;
}


vec4 encodeRE8(float _r)
{
    float exponent = ceil(log2(_r) );
    return vec4(_r / exp2(exponent)
            , 0.0
            , 0.0
            , (exponent + 128.0) / 255.0
            );
}

float decodeRE8(vec4 _re8)
{
    float exponent = _re8.w * 255.0 - 128.0;
    return _re8.x * exp2(exponent);
}

vec4 encodeRGBE8(vec3 _rgb)
{
    vec4 rgbe8;
    float maxComponent = max(max(_rgb.x, _rgb.y), _rgb.z);
    float exponent = ceil(log2(maxComponent) );
    rgbe8.xyz = _rgb / exp2(exponent);
    rgbe8.w = (exponent + 128.0) / 255.0;
    return rgbe8;
}

vec3 decodeRGBE8(vec4 _rgbe8)
{
    float exponent = _rgbe8.w * 255.0 - 128.0;
    vec3 rgb = _rgbe8.xyz * exp2(exponent);
    return rgb;
}

// Reference:
// RGB/XYZ Matrices
// http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
vec3 convertRGB2XYZ(vec3 _rgb)
{
    vec3 xyz;
    xyz.x = dot(vec3(0.4124564, 0.3575761, 0.1804375), _rgb);
    xyz.y = dot(vec3(0.2126729, 0.7151522, 0.0721750), _rgb);
    xyz.z = dot(vec3(0.0193339, 0.1191920, 0.9503041), _rgb);
    return xyz;
}

vec3 convertXYZ2RGB(vec3 _xyz)
{
    vec3 rgb;
    rgb.x = dot(vec3( 3.2404542, -1.5371385, -0.4985314), _xyz);
    rgb.y = dot(vec3(-0.9692660,  1.8760108,  0.0415560), _xyz);
    rgb.z = dot(vec3( 0.0556434, -0.2040259,  1.0572252), _xyz);
    return rgb;
}

vec3 convertXYZ2Yxy(vec3 _xyz)
{
    // Reference:
    // http://www.brucelindbloom.com/index.html?Eqn_XYZ_to_xyY.html
    float inv = 1.0/dot(_xyz, vec3(1.0, 1.0, 1.0) );
    return vec3(_xyz.y, _xyz.x*inv, _xyz.y*inv);
}

vec3 convertYxy2XYZ(vec3 _Yxy)
{
    // Reference:
    // http://www.brucelindbloom.com/index.html?Eqn_xyY_to_XYZ.html
    vec3 xyz;
    xyz.x = _Yxy.x*_Yxy.y/_Yxy.z;
    xyz.y = _Yxy.x;
    xyz.z = _Yxy.x*(1.0 - _Yxy.y - _Yxy.z)/_Yxy.z;
    return xyz;
}

vec3 convertRGB2Yxy(vec3 _rgb)
{
    return convertXYZ2Yxy(convertRGB2XYZ(_rgb) );
}

vec3 convertYxy2RGB(vec3 _Yxy)
{
    return convertXYZ2RGB(convertYxy2XYZ(_Yxy) );
}

vec3 convertRGB2Yuv(vec3 _rgb)
{
    vec3 yuv;
    yuv.x = dot(_rgb, vec3(0.299, 0.587, 0.114) );
    yuv.y = (_rgb.x - yuv.x)*0.713 + 0.5;
    yuv.z = (_rgb.z - yuv.x)*0.564 + 0.5;
    return yuv;
}

vec3 convertYuv2RGB(vec3 _yuv)
{
    vec3 rgb;
    rgb.x = _yuv.x + 1.403*(_yuv.y-0.5);
    rgb.y = _yuv.x - 0.344*(_yuv.y-0.5) - 0.714*(_yuv.z-0.5);
    rgb.z = _yuv.x + 1.773*(_yuv.z-0.5);
    return rgb;
}

vec3 convertRGB2YIQ(vec3 _rgb)
{
    vec3 yiq;
    yiq.x = dot(vec3(0.299,     0.587,     0.114   ), _rgb);
    yiq.y = dot(vec3(0.595716, -0.274453, -0.321263), _rgb);
    yiq.z = dot(vec3(0.211456, -0.522591,  0.311135), _rgb);
    return yiq;
}

vec3 convertYIQ2RGB(vec3 _yiq)
{
    vec3 rgb;
    rgb.x = dot(vec3(1.0,  0.9563,  0.6210), _yiq);
    rgb.y = dot(vec3(1.0, -0.2721, -0.6474), _yiq);
    rgb.z = dot(vec3(1.0, -1.1070,  1.7046), _yiq);
    return rgb;
}

vec3 toLinear(vec3 _rgb)
{
    return pow(_rgb, vec3_splat(2.2) );
}

vec4 toLinear(vec4 _rgba)
{
    return vec4(toLinear(_rgba.xyz), _rgba.w);
}

vec3 toGamma(vec3 _rgb)
{
    return pow(_rgb, vec3_splat(1.0/2.2) );
}

vec4 toGamma(vec4 _rgba)
{
    return vec4(toGamma(_rgba.xyz), _rgba.w);
}

vec3 toReinhard(vec3 _rgb)
{
    return toGamma(_rgb/(_rgb+vec3_splat(1.0) ) );
}

vec4 toReinhard(vec4 _rgba)
{
    return vec4(toReinhard(_rgba.xyz), _rgba.w);
}

vec3 toFilmic(vec3 _rgb)
{
    _rgb = max(vec3_splat(0.0), _rgb - 0.004);
    _rgb = (_rgb*(6.2*_rgb + 0.5) ) / (_rgb*(6.2*_rgb + 1.7) + 0.06);
    return _rgb;
}

vec4 toFilmic(vec4 _rgba)
{
    return vec4(toFilmic(_rgba.xyz), _rgba.w);
}

vec3 luma(vec3 _rgb)
{
    float yy = dot(vec3(0.2126729, 0.7151522, 0.0721750), _rgb);
    return vec3_splat(yy);
}

vec4 luma(vec4 _rgba)
{
    return vec4(luma(_rgba.xyz), _rgba.w);
}

vec3 conSatBri(vec3 _rgb, vec3 _csb)
{
    vec3 rgb = _rgb * _csb.z;
    rgb = lerp(luma(rgb), rgb, _csb.y);
    rgb = lerp(vec3_splat(0.5), rgb, _csb.x);
    return rgb;
}

vec4 conSatBri(vec4 _rgba, vec3 _csb)
{
    return vec4(conSatBri(_rgba.xyz, _csb), _rgba.w);
}

vec3 posterize(vec3 _rgb, float _numColors)
{
    return floor(_rgb*_numColors) / _numColors;
}

vec4 posterize(vec4 _rgba, float _numColors)
{
    return vec4(posterize(_rgba.xyz, _numColors), _rgba.w);
}

vec3 sepia(vec3 _rgb)
{
    vec3 color;
    color.x = dot(_rgb, vec3(0.393, 0.769, 0.189) );
    color.y = dot(_rgb, vec3(0.349, 0.686, 0.168) );
    color.z = dot(_rgb, vec3(0.272, 0.534, 0.131) );
    return color;
}

vec4 sepia(vec4 _rgba)
{
    return vec4(sepia(_rgba.xyz), _rgba.w);
}

vec3 blendOverlay(vec3 _base, vec3 _blend)
{
    vec3 lt = 2.0 * _base * _blend;
    vec3 gte = 1.0 - 2.0 * (1.0 - _base) * (1.0 - _blend);
    return lerp(lt, gte, step(vec3_splat(0.5), _base) );
}

vec4 blendOverlay(vec4 _base, vec4 _blend)
{
    return vec4(blendOverlay(_base.xyz, _blend.xyz), _base.w);
}

vec3 adjustHue(vec3 _rgb, float _hue)
{
    vec3 yiq = convertRGB2YIQ(_rgb);
    float angle = _hue + atan2(yiq.z, yiq.y);
    float len = length(yiq.yz);
    return convertYIQ2RGB(vec3(yiq.x, len*cos(angle), len*sin(angle) ) );
}

vec4 packFloatToRgba(float _value)
{
    const vec4 shift = vec4(256 * 256 * 256, 256 * 256, 256, 1.0);
    const vec4 mask = vec4(0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 comp = fract(_value * shift);
    comp -= comp.xxyz * mask;
    return comp;
}

float unpackRgbaToFloat(vec4 _rgba)
{
    const vec4 shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(_rgba, shift);
}

float random(vec2 _uv)
{
    return fract(sin(dot(_uv.xy, vec2(12.9898, 78.233) ) ) * 43758.5453);
}