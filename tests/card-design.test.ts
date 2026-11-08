import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCardDesign, changeCardOrientation, validateCardDesign, cardSize, type CardOrientation} from '../shared/businessCardDesign.ts';

test('legacy documents remain landscape and retain their content', () => {
  const legacy = initialCardDesign(); delete legacy.orientation;
  const normalized = validateCardDesign(legacy)!;
  assert.equal(normalized.orientation, 'landscape');
  assert.deepEqual(normalized.front, legacy.front);
  assert.deepEqual(cardSize(normalized.orientation), {width:910,height:550});
});
test('all templates validate in both orientations and start with one text field', () => {
  for (const orientation of ['landscape','portrait'] as CardOrientation[]) for (const template of ['basic','band','blank'] as const) {
    const design = initialCardDesign(template, orientation);
    assert.equal(validateCardDesign(design)!.orientation, orientation);
    assert.equal(design.front.elements.filter(e=>e.kind==='text').length, template==='blank'?0:1);
  }
});
test('switching preserves both faces, text, image content, order, rotation and fields', () => {
  const original = initialCardDesign();
  original.front.elements.push({id:'picture',kind:'image',x:100,y:300,width:200,height:140,rotation:15,color:'#ffffff',opacity:0.5,src:'data:image/png;base64,YWJj'});
  original.back.elements = [{...original.front.elements[1],id:'back',text:'裏面の文字',binding:undefined,field:'company'}];
  const portrait = changeCardOrientation(original,'portrait');
  assert.equal(validateCardDesign(portrait)!.orientation,'portrait');
  for (const face of ['front','back'] as const) for (let i=0;i<original[face].elements.length;i++) {
    const before=original[face].elements[i],after=portrait[face].elements[i];
    for (const key of ['id','kind','text','src','field','rotation','opacity','color','binding'] as const) assert.equal(after[key],before[key]);
  }
  assert.equal(original.orientation,'landscape');
  assert.deepEqual(changeCardOrientation(original,'landscape'),original);
  assert.equal(portrait.front.elements[0].height,12,'Full-width accent retains thickness');
  assert.equal(portrait.front.elements[0].y,0,'Top accent stays at top');
  const band=changeCardOrientation(changeCardOrientation(initialCardDesign('band'),'portrait'),'landscape');
  assert.equal(band.front.elements[0].x,0,'Side accent stays at left edge');
});
test('portrait allows tall elements and repeated switches keep valid bounds', () => {
  let design=initialCardDesign('blank','portrait');
  design.front.elements.push({id:'tall',kind:'rect',x:20,y:10,width:300,height:870,rotation:0,color:'#ffffff',opacity:1});
  validateCardDesign(design);
  for(let i=0;i<12;i++) {
    design=changeCardOrientation(design,i%2?'portrait':'landscape');
    assert.doesNotThrow(()=>validateCardDesign(design));
    assert.equal(design.front.elements.length,1);
  }
});
test('orientation and geometry are validated on the server format', () => {
  const portrait=initialCardDesign('basic','portrait');
  assert.throws(()=>validateCardDesign({...portrait,orientation:'invalid'}));
  const bad=structuredClone(portrait);bad.front.elements[1].width=900;
  assert.throws(()=>validateCardDesign(bad));
  const tall=initialCardDesign('blank','portrait');
  tall.front.elements.push({id:'shape',kind:'rect',x:0,y:600,width:100,height:200,rotation:0,color:'#000000',opacity:1});
  assert.doesNotThrow(()=>validateCardDesign(tall));
  assert.throws(()=>validateCardDesign({...tall,orientation:'landscape'}));
});

test('rotated elements also stay inside the target canvas', () => {
  const design=initialCardDesign('blank');
  design.front.elements.push({id:'rotated',kind:'rect',x:200,y:20,width:500,height:500,rotation:45,color:'#000000',opacity:1});
  const changed=changeCardOrientation(design,'portrait'),el=changed.front.elements[0];
  const angle=el.rotation*Math.PI/180;
  const halfWidth=(Math.abs(el.width*Math.cos(angle))+Math.abs(el.height*Math.sin(angle)))/2;
  const halfHeight=(Math.abs(el.width*Math.sin(angle))+Math.abs(el.height*Math.cos(angle)))/2;
  assert.ok(el.x+el.width/2-halfWidth>=-0.01 && el.x+el.width/2+halfWidth<=550.01);
  assert.ok(el.y+el.height/2-halfHeight>=-0.01 && el.y+el.height/2+halfHeight<=910.01);
  assert.doesNotThrow(()=>validateCardDesign(changed));
});
