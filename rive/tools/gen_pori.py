"""Generates rive/pori/scene.rml (2.5D clay-style Pori). Usage: python3 gen_pori.py <out.rml>"""
import sys

# ---------- palette (AARRGGBB) ----------
CREAM = dict(hi="FFFFFEFA", base="FFFFF3E0", lo="FFF6DDBE", shade="B0E2B48C")
MINT = dict(hi="FFC9F7EB", base="FF9CE5D5", lo="FF74D2BF", shade="A04FB9A6")
WHITE = dict(hi="FFFFFFFF", base="FFFFFCF6", lo="FFF9EBDA", shade="70E8C4A2")
DARK = "FF3B2F2D"
PINK = "FFFFB1A6"
TONGUE = "FFFF8E9E"


def clay(name, w, h, pal, x=0, y=0, rot=0, sid=None, feather=None, shade=True, extra=""):
    """A matte 'clay' blob: radial-gradient base + inner-feather shade on the far side from the light."""
    m = max(w, h)
    sx, sy = -0.20 * w, -0.26 * h
    r = 0.92 * m
    f = feather if feather is not None else max(6, 0.13 * min(w, h))
    off = f * 0.55
    idattr = f' id="{sid}"' if sid else ""
    rotattr = f' rotation="{rot}"' if rot else ""
    s = f'<Shape x="{x}" y="{y}"{rotattr} name="{name}"{idattr}>'
    s += f'<Ellipse width="{w}" height="{h}" name="{name}Path"/>'
    s += (f'<Fill name="{name}Base"><RadialGradient startX="{sx:.1f}" startY="{sy:.1f}" endX="{sx + r:.1f}" endY="{sy:.1f}" name="Gradient">'
          f'<GradientStop colorValue="{pal["hi"]}" position="0"/>'
          f'<GradientStop colorValue="{pal["base"]}" position="0.5"/>'
          f'<GradientStop colorValue="{pal["lo"]}" position="1"/></RadialGradient></Fill>')
    if shade:
        s += (f'<Fill fillRule="clockwise" name="{name}Shade"><SolidColor colorValue="{pal["shade"]}" name="Color"/>'
              f'<Feather inner="true" strength="{f:.1f}" offsetX="{-off:.1f}" offsetY="{-off:.1f}" name="Feather"/></Fill>')
    s += extra + '</Shape>'
    return s


def flat(name, w, h, color, x=0, y=0, rot=0, sid=None, opacity=None):
    idattr = f' id="{sid}"' if sid else ""
    rotattr = f' rotation="{rot}"' if rot else ""
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return (f'<Shape x="{x}" y="{y}"{rotattr}{op} name="{name}"{idattr}><Ellipse width="{w}" height="{h}" name="{name}Path"/>'
            f'<Fill name="{name}Fill"><SolidColor colorValue="{color}" name="Color"/></Fill></Shape>')


def soft(name, w, h, color, strength, x=0, y=0, rot=0, sid=None):
    idattr = f' id="{sid}"' if sid else ""
    rotattr = f' rotation="{rot}"' if rot else ""
    return (f'<Shape x="{x}" y="{y}"{rotattr} name="{name}"{idattr}><Ellipse width="{w}" height="{h}" name="{name}Path"/>'
            f'<Fill fillRule="clockwise" name="{name}Fill"><SolidColor colorValue="{color}" name="Color"/>'
            f'<Feather strength="{strength}" name="Feather"/></Fill></Shape>')


def arc(name, x, y, half, lift, thick, sid=None, color=DARK):
    """Open arc (brow / closed eye): ends at +-half, bulging upward by `lift`."""
    idattr = f' id="{sid}"' if sid else ""
    d = half * 0.8
    return (f'<Shape x="{x}" y="{y}" name="{name}"{idattr}><PointsPath isClosed="false" name="{name}Path">'
            f'<CubicDetachedVertex x="{-half}" y="{lift}" inRotation="0" inDistance="0" outRotation="-0.62" outDistance="{d:.1f}"/>'
            f'<CubicDetachedVertex x="{half}" y="{lift}" inRotation="3.76" inDistance="{d:.1f}" outRotation="0" outDistance="0"/>'
            f'</PointsPath><Stroke thickness="{thick}" cap="round" name="{name}Stroke"><SolidColor colorValue="{color}" name="Color"/></Stroke></Shape>')


# ---------- character ----------
EYE_X, EYE_Y = 80, -4
BROW_Y = -64
HEAD_Y = -95
ARM_ROT = 0.95
TAIL_ROT = -1.85

cute = f'''<Node opacity="0" name="CuteFace" id="0:70">
{flat("CuteTongue", 34, 24, TONGUE, 0, 76)}
{flat("CuteMouth", 62, 56, DARK, 0, 62)}
{arc("CuteEyeLeft", -EYE_X, EYE_Y, 26, 8, 10)}
{arc("CuteEyeRight", EYE_X, EYE_Y, 26, 8, 10)}
{flat("CuteBlushLeftOne", 22, 7, TONGUE, -150, 30, -0.3)}
{flat("CuteBlushLeftTwo", 20, 7, TONGUE, -132, 22, -0.3)}
{flat("CuteBlushRightOne", 22, 7, TONGUE, 150, 30, 0.3)}
{flat("CuteBlushRightTwo", 20, 7, TONGUE, 132, 22, 0.3)}
</Node>'''

mouth = f'''<Shape x="0" y="56" name="Mouth" id="0:62"><PointsPath isClosed="false" name="MouthPath">
<CubicDetachedVertex x="-27" y="-3" inRotation="0" inDistance="0" outRotation="0.6" outDistance="17"/>
<CubicDetachedVertex x="0" y="13" inRotation="3.14159" inDistance="14" outRotation="0" outDistance="14"/>
<CubicDetachedVertex x="27" y="-3" inRotation="2.54" inDistance="17" outRotation="0" outDistance="0"/>
</PointsPath><Stroke thickness="8.5" cap="round" join="round" name="MouthStroke"><SolidColor colorValue="{DARK}" name="Color"/></Stroke></Shape>'''


def ear(side):
    sgn = -1 if side == "Left" else 1
    return (f'<Node x="{sgn * 150}" y="-122" rotation="{sgn * 0.42}" name="Ear{side}">'
            + clay(f"Ear{side}Inner", 54, 56, MINT, 0, 6, feather=7)
            + clay(f"Ear{side}Outer", 104, 104, CREAM)
            + '</Node>')


head = f'''<Node x="0" y="{HEAD_Y}" name="Head" id="0:50">
{cute}
{flat("EyeLeftHighlight", 13, 16, "FFFFFFFF", -EYE_X - 8, EYE_Y - 13, sid="0:67")}
{flat("EyeRightHighlight", 13, 16, "FFFFFFFF", EYE_X - 8, EYE_Y - 13, sid="0:68")}
{flat("NoseShine", 14, 7, "66FFFFFF", -6, 17, -0.2)}
{flat("Nose", 44, 29, DARK, 0, 24)}
{mouth}
{flat("EyeLeft", 42, 54, DARK, -EYE_X, EYE_Y, sid="0:65")}
{flat("EyeRight", 42, 54, DARK, EYE_X, EYE_Y, sid="0:66")}
{arc("BrowLeft", -EYE_X - 2, BROW_Y, 15, 4, 8, sid="0:63")}
{arc("BrowRight", EYE_X + 2, BROW_Y, 15, 4, 8, sid="0:64")}
{flat("CheekLeft", 60, 34, PINK, -134, 44, -0.08, sid="0:69")}
{flat("CheekRight", 60, 34, PINK, 134, 44, 0.08, sid="0:71")}
{clay("Muzzle", 156, 108, WHITE, 0, 50, feather=14)}
{soft("HeadGlow", 150, 90, "8CFFFFFF", 34, -70, -105, -0.35)}
{clay("HeadBase", 400, 340, CREAM, feather=46)}
{ear("Left")}
{ear("Right")}
</Node>'''


def arm(side, sid):
    sgn = -1 if side == "Left" else 1
    return (f'<Node x="{sgn * 88}" y="112" rotation="{-sgn * ARM_ROT}" name="Arm{side}" id="{sid}">'
            + clay(f"Arm{side}Shape", 66, 104, CREAM, 0, 38)
            + '</Node>')


def leg(side):
    sgn = -1 if side == "Left" else 1
    return (f'<Node x="{sgn * 54}" y="116" rotation="{-sgn * 0.12}" name="Leg{side}">'
            + clay(f"Leg{side}Shape", 86, 62, CREAM)
            + '</Node>')


body = f'''<Node x="0" y="160" name="Body" id="0:30">
{clay("Belly", 150, 156, MINT, 0, 22, shade=False)}
<Node name="BodyShadows"><ClippingShape sourceId="0:31" name="BodyClip"/>
{soft("NeckShadow", 230, 90, "70D9A679", 20, 0, -112)}
</Node>
{clay("BodyBase", 244, 256, CREAM, sid="0:31", feather=34)}
{leg("Left")}
{leg("Right")}
</Node>'''

tail = f'''<Node x="76" y="228" rotation="{TAIL_ROT}" name="Tail" id="0:40">
{clay("TailTip", 130, 100, MINT, 0, 168, shade=False, extra='<ClippingShape sourceId="0:41" name="TailClip"/>')}
{clay("TailBase", 80, 204, CREAM, 0, 84, sid="0:41")}
</Node>'''

character = f'''<Node x="400" y="405" name="PoriRoot" id="0:20">
{head}
{body}
{arm("Left", "0:60")}
{arm("Right", "0:61")}
{tail}
</Node>
{soft("GroundShadow", 300, 40, "55287A66", 16, 400, 716, sid="0:21")}'''


# ---------- animations ----------
def keys(prop, frames, ease=True):
    out = f'<KeyedProperty property="{prop}">'
    for i, (fr, v) in enumerate(frames):
        last = i == len(frames) - 1
        if ease and not last:
            out += (f'<KeyFrameDouble value="{v}" frame="{fr}" interpolationType="cubic">'
                    f'<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/></KeyFrameDouble>')
        else:
            out += f'<KeyFrameDouble value="{v}" frame="{fr}" interpolationType="linear"/>'
    return out + '</KeyedProperty>'


# every market animation keys the full set, so no pose leaks from the previous state
DEFAULTS = {
    ("0:20", "y"): 405, ("0:20", "rotation"): 0, ("0:20", "scaleX"): 1,
    ("0:30", "scaleY"): 1,
    ("0:50", "y"): HEAD_Y, ("0:50", "rotation"): 0,
    ("0:60", "rotation"): ARM_ROT, ("0:61", "rotation"): -ARM_ROT,
    ("0:40", "rotation"): TAIL_ROT,
    ("0:62", "scaleY"): 1,
    ("0:63", "rotation"): 0, ("0:64", "rotation"): 0,
    ("0:63", "y"): BROW_Y, ("0:64", "y"): BROW_Y,
    ("0:65", "x"): -EYE_X, ("0:66", "x"): EYE_X,
    ("0:67", "x"): -EYE_X - 8, ("0:68", "x"): EYE_X - 8,
    ("0:21", "scaleX"): 1, ("0:21", "opacity"): 1,
}


def animation(name, aid, duration, loop, overrides):
    props = {}
    for k, v in DEFAULTS.items():
        props[k] = overrides.get(k, [(0, v)])
    objs = {}
    for (oid, prop), frames in props.items():
        objs.setdefault(oid, []).append(keys(prop, frames))
    body_ = "".join(f'<KeyedObject objectId="{oid}">{"".join(ps)}</KeyedObject>\n' for oid, ps in objs.items())
    return f'<LinearAnimation fps="60" loopValue="{loop}" duration="{duration}" name="{name}" id="{aid}">\n{body_}</LinearAnimation>\n'


A, T = ARM_ROT, TAIL_ROT
rise = animation("Rise", "0:201", 170, "loop", {
    ("0:20", "y"): [(0, 405), (9, 414), (30, 318), (52, 405), (170, 405)],
    ("0:30", "scaleY"): [(0, 1), (9, 0.92), (24, 1.07), (44, 1), (55, 0.94), (66, 1.02), (78, 1), (124, 1.02), (170, 1)],
    ("0:50", "y"): [(0, HEAD_Y), (9, HEAD_Y + 8), (30, HEAD_Y - 8), (52, HEAD_Y), (56, HEAD_Y + 5), (70, HEAD_Y), (170, HEAD_Y)],
    ("0:60", "rotation"): [(0, A), (9, 0.7), (30, 2.15), (56, 1.7), (86, A), (170, A)],
    ("0:61", "rotation"): [(0, -A), (9, -0.7), (30, -2.15), (56, -1.7), (86, -A), (170, -A)],
    ("0:40", "rotation"): [(0, T), (30, T - 0.4), (70, T), (120, T - 0.14), (170, T)],
    ("0:63", "y"): [(0, BROW_Y - 9)], ("0:64", "y"): [(0, BROW_Y - 9)],
    ("0:21", "scaleX"): [(0, 1), (9, 1.04), (30, 0.62), (52, 1), (170, 1)],
    ("0:21", "opacity"): [(0, 1), (9, 1), (30, 0.5), (52, 1), (170, 1)],
})
flat_ = animation("Flat", "0:202", 180, "loop", {
    ("0:20", "rotation"): [(0, -0.02), (90, 0.02), (180, -0.02)],
    ("0:30", "scaleY"): [(0, 1), (90, 1.025), (180, 1)],
    ("0:50", "rotation"): [(0, 0.015), (90, -0.015), (180, 0.015)],
    ("0:40", "rotation"): [(0, T), (90, T + 0.14), (180, T)],
})
fall = animation("Fall", "0:203", 140, "loop", {
    ("0:20", "y"): [(0, 413), (70, 419), (140, 413)],
    ("0:30", "scaleY"): [(0, 0.97), (70, 0.955), (140, 0.97)],
    ("0:50", "y"): [(0, HEAD_Y + 10), (70, HEAD_Y + 14), (140, HEAD_Y + 10)],
    ("0:50", "rotation"): [(0, 0.035)],
    ("0:60", "rotation"): [(0, 0.5)], ("0:61", "rotation"): [(0, -0.5)],
    ("0:40", "rotation"): [(0, T + 0.5), (70, T + 0.56), (140, T + 0.5)],
    ("0:62", "scaleY"): [(0, -1)],
    ("0:63", "rotation"): [(0, -0.3)], ("0:64", "rotation"): [(0, 0.3)],
    ("0:63", "y"): [(0, BROW_Y + 3)], ("0:64", "y"): [(0, BROW_Y + 3)],
})
loading = animation("Loading", "0:204", 120, "loop", {
    ("0:20", "y"): [(0, 405), (60, 395), (120, 405)],
    ("0:50", "rotation"): [(0, -0.05), (60, 0.05), (120, -0.05)],
    ("0:40", "rotation"): [(0, T), (60, T + 0.14), (120, T)],
    ("0:65", "x"): [(0, -EYE_X - 6), (60, -EYE_X + 6), (120, -EYE_X - 6)],
    ("0:66", "x"): [(0, EYE_X - 6), (60, EYE_X + 6), (120, EYE_X - 6)],
    ("0:67", "x"): [(0, -EYE_X - 14), (60, -EYE_X - 2), (120, -EYE_X - 14)],
    ("0:68", "x"): [(0, EYE_X - 14), (60, EYE_X - 2), (120, EYE_X - 14)],
    ("0:21", "scaleX"): [(0, 1), (60, 0.94), (120, 1)],
})
error = animation("Error", "0:205", 90, "oneShot", {
    ("0:50", "rotation"): [(0, 0), (32, 0.14), (90, 0.06)],
    ("0:20", "scaleX"): [(0, 1), (18, 1.035), (90, 1)],
    ("0:62", "scaleY"): [(0, 1), (24, 0.28), (90, 0.5)],
    ("0:63", "y"): [(0, BROW_Y), (20, BROW_Y - 10), (90, BROW_Y - 6)],
    ("0:64", "y"): [(0, BROW_Y), (20, BROW_Y - 10), (90, BROW_Y - 6)],
})


def fade(oid):
    return (f'<KeyedObject objectId="{oid}">'
            + keys("opacity", [(0, 1), (6, 0), (78, 0), (96, 1)], ease=False) + '</KeyedObject>\n')


cute_touch = ('<LinearAnimation fps="60" loopValue="oneShot" duration="96" name="Cute Touch" id="0:206">\n'
              '<KeyedObject objectId="0:70">'
              + keys("opacity", [(0, 0), (7, 1), (74, 1), (96, 0)], ease=False)
              + keys("scaleY", [(0, 0.72), (12, 1.08), (22, 1), (80, 1), (96, 0.84)])
              + '</KeyedObject>\n'
              + "".join(fade(o) for o in ["0:65", "0:66", "0:67", "0:68", "0:62", "0:63", "0:64"])
              + '<KeyedObject objectId="0:69">' + keys("scaleX", [(0, 1), (12, 1.25), (74, 1.12), (96, 1)]) + '</KeyedObject>\n'
              + '<KeyedObject objectId="0:71">' + keys("scaleX", [(0, 1), (12, 1.25), (74, 1.12), (96, 1)]) + '</KeyedObject>\n'
              + '<KeyedObject objectId="0:50">' + keys("scaleY", [(0, 1), (8, 0.95), (16, 1.05), (26, 1), (96, 1)]) + '</KeyedObject>\n'
              + '</LinearAnimation>\n')

touch_idle = ('<LinearAnimation fps="60" loopValue="loop" duration="60" name="Touch Idle" id="0:207">\n'
              '<KeyedObject objectId="0:70"><KeyedProperty property="opacity"><KeyFrameDouble value="0" frame="0"/></KeyedProperty></KeyedObject>\n'
              '</LinearAnimation>\n')

blink_frames = [(0, 1), (150, 1), (155, 0.08), (161, 1), (210, 1)]
blink = ('<LinearAnimation fps="60" loopValue="loop" duration="210" name="Blink" id="0:208">\n'
         + "".join(f'<KeyedObject objectId="{o}">' + keys("scaleY", blink_frames) + '</KeyedObject>\n'
                   for o in ["0:65", "0:66", "0:67", "0:68"])
         + '</LinearAnimation>\n')


def route(to, enum):
    return (f'<StateTransition stateToId="{to}" duration="160"><TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator>'
            f'<BindablePropertyEnum><DataBindContext sourcePathIds="0:110-0:112" propertyKey="637"/></BindablePropertyEnum>'
            f'</TransitionPropertyViewModelComparator><TransitionValueEnumComparator value="{enum}"/></TransitionViewModelCondition></StateTransition>')


state_machine = f'''<StateMachine name="MarketStateMachine" id="0:7">
<StateMachineLayer name="MarketMotion" id="0:8">
<AnyState x="300" y="-170" stateName="Market Router">
{route("0:121", "0:101")}
{route("0:122", "0:102")}
{route("0:123", "0:103")}
{route("0:124", "0:104")}
{route("0:125", "0:105")}
</AnyState>
<ExitState x="540" y="-170"/>
<EntryState x="0" y="0"><StateTransition stateToId="0:124"/></EntryState>
<AnimationState x="180" y="-80" animationId="0:201" stateName="Rise" id="0:121"/>
<AnimationState x="360" y="0" animationId="0:202" stateName="Flat" id="0:122"/>
<AnimationState x="180" y="80" animationId="0:203" stateName="Fall" id="0:123"/>
<AnimationState x="0" y="-100" animationId="0:204" stateName="Loading" id="0:124"/>
<AnimationState x="0" y="100" animationId="0:205" stateName="Error" id="0:125"/>
</StateMachineLayer>
<StateMachineLayer name="Blink" id="0:10">
<AnyState x="300" y="-100"/>
<ExitState x="500" y="-100"/>
<EntryState x="0" y="0"><StateTransition stateToId="0:128"/></EntryState>
<AnimationState x="160" y="0" animationId="0:208" stateName="Blink" id="0:128"/>
</StateMachineLayer>
<StateMachineLayer name="TouchExpression" id="0:9">
<AnyState x="300" y="-100" stateName="Touch Router">
<StateTransition stateToId="0:127" duration="40"><TransitionViewModelCondition><TransitionPropertyViewModelComparator>
<BindablePropertyTrigger><DataBindContext sourcePathIds="0:110-0:116" propertyKey="686"/></BindablePropertyTrigger>
</TransitionPropertyViewModelComparator><TransitionValueTriggerComparator value="1"/></TransitionViewModelCondition></StateTransition>
</AnyState>
<ExitState x="500" y="-100"/>
<EntryState x="0" y="0"><StateTransition stateToId="0:126"/></EntryState>
<AnimationState x="160" y="0" animationId="0:207" stateName="Touch Idle" id="0:126"/>
<AnimationState x="340" y="0" animationId="0:206" stateName="Cute Touch" reset="true" id="0:127">
<StateTransition stateToId="0:126" duration="100" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>
</AnimationState>
</StateMachineLayer>
</StateMachine>'''

data = '''<DataEnumCustom name="MarketState" id="0:100">
<DataEnumValue key="rise" value="Rise" id="0:101"/>
<DataEnumValue key="flat" value="Flat" id="0:102"/>
<DataEnumValue key="fall" value="Fall" id="0:103"/>
<DataEnumValue key="loading" value="Loading" id="0:104"/>
<DataEnumValue key="error" value="Error" id="0:105"/>
</DataEnumCustom>
<ViewModel defaultInstanceId="0:111" name="MarketViewModel" id="0:110">
<ViewModelPropertyEnumCustom enumId="0:100" name="marketState" id="0:112"/>
<ViewModelPropertyNumber name="changeRate" id="0:113"/>
<ViewModelPropertyNumber name="kospiValue" id="0:114"/>
<ViewModelPropertyString name="updatedAt" id="0:115"/>
<ViewModelPropertyTrigger name="touchReaction" id="0:116"/>
<ViewModelInstance exports="true" name="Default" id="0:111">
<ViewModelInstanceEnum propertyValue="0:104" viewModelPropertyId="0:112"/>
<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:113"/>
<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:114"/>
<ViewModelInstanceString propertyValue="-" viewModelPropertyId="0:115"/>
<ViewModelInstanceTrigger propertyValue="0" viewModelPropertyId="0:116" id="0:117"/>
</ViewModelInstance>
</ViewModel>'''

BG = sys.argv[2] if len(sys.argv) > 2 else ""
bg = (f'<Shape x="400" y="400" name="PreviewBg"><Rectangle width="800" height="800" name="P"/>'
      f'<Fill name="F"><SolidColor colorValue="{BG}" name="C"/></Fill></Shape>') if BG else ""

doc = f'''<Rive version="1" kind="fragment">
<Artboard defaultStateMachineId="0:7" viewModelId="0:110" viewModelInstanceId="0:111" styleId="0:5" width="800" height="800" name="PoriMarket" id="0:2">
<LayoutComponentStyle name="Artboard Style" id="0:5"/>
{character}
{bg}
{state_machine}
{rise}{flat_}{fall}{loading}{error}{cute_touch}{touch_idle}{blink}</Artboard>
{data}
</Rive>
'''
open(sys.argv[1], "w").write(doc)
