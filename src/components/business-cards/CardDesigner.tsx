import {useEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, Copy, ImagePlus, Redo2, Trash2, Type, Undo2, ZoomIn, ZoomOut} from 'lucide-react';
import {CARD_HEIGHT, cardSize, changeCardOrientation, type CardOrientation, initialCardDesign, type CardDesign, type CardElement, type CardBinding} from '../../../shared/businessCardDesign';
import {CardElementArtwork, elementTransform} from './CardArtwork';
import {designImage, type BusinessCard} from './cardTools';

type Props = {card: BusinessCard; onChange: (design: CardDesign) => void; onProcessing: (busy: boolean) => void};
const textFields: {key: CardBinding; label: string; y: number}[] = [
  {key:'name',label:'氏名',y:142}, {key:'company',label:'会社・所属',y:64},
  {key:'role',label:'役職',y:248}, {key:'email',label:'メールアドレス',y:325},
  {key:'phone',label:'電話番号',y:375}, {key:'website',label:'Webサイト',y:425},
];
const fieldLabel = (el: CardElement) => textFields.find(f => f.key === (el.field || el.binding))?.label;
type Side = 'front' | 'back';
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const control = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-normal';
const btn = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold hover:bg-blue-50 disabled:opacity-40';

export default function CardDesigner({card, onChange, onProcessing}: Props) {
  const initial = useRef(card.design || initialCardDesign());
  const design = card.design || initial.current;
  const {width: W, height: H} = cardSize(design.orientation);
  const [side, setSide] = useState<Side>('front');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textType, setTextType] = useState<CardBinding | 'custom'>('custom');
  const [tool, setTool] = useState<'text' | 'shape' | 'image'>('text');
  const [past, setPast] = useState<CardDesign[]>([]), [future, setFuture] = useState<CardDesign[]>([]);
  const [zoom, setZoom] = useState(1), [grid, setGrid] = useState(false), [guide, setGuide] = useState(true);
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const addImage = useRef<(src: string) => void>(() => {});
  addImage.current = src => add('image', src);
  const drag = useRef<{pointer: number; x: number; y: number; original: CardElement; before: CardDesign; resize: boolean; moved: boolean} | null>(null);
  const face = design[side];
  const selected = face.elements.find(el => el.id === selectedId);

  // Initialize a new document once, so saving without touching the canvas preserves the preview.
  useEffect(() => {if (!card.design) onChange(initial.current);}, [card.design]);

  function commit(next: CardDesign) {
    if (JSON.stringify(next) === JSON.stringify(design)) return;
    setPast(p => [...p, design].slice(-40)); setFuture([]); onChange(next);
  }
  function updateElement(patch: Partial<CardElement>) {
    if (!selected) return;
    const next = {...selected, ...patch};
    next.width = clamp(next.width, 8, W); next.height = clamp(next.height, 8, H);
    next.x = clamp(next.x, 0, W - next.width); next.y = clamp(next.y, 0, H - next.height);
    commit({...design, [side]: {...face, elements: face.elements.map(el => el.id === selected.id ? next : el)}});
  }
  function add(kind: CardElement['kind'], src?: string, field?: CardBinding) {
    if (face.elements.length >= 50) {setError('1面につき50個まで配置できます。'); return;}
    const id = crypto.randomUUID();
    const height = kind === 'text' ? (field === 'name' ? 80 : 60) : 140;
    // Choose an unused row so newly added text can be selected without covering the name.
    const preferredY = (textFields.find(f => f.key === field)?.y ?? 64) * H / CARD_HEIGHT;
    const rows = [preferredY, 248, 325, 395, 475, 10, 150, ...Array.from({length: Math.floor(H / 70)}, (_, i) => i * 70)];
    const y = kind === 'text' ? rows.find(y => y + height <= H && !face.elements.some(el =>
      el.kind === 'text' && y < el.y + el.height && y + height > el.y)) ?? preferredY : 100;
    const el: CardElement = {id, kind, x: kind === 'text' ? 85 : 100, y, width: kind === 'text' ? Math.min(field ? W - 170 : 500, W - 85) : 200,
      height, rotation: 0, color: '#2563eb', opacity: 1,
      ...(kind === 'text' ? {text: field ? '' : 'テキストを入力', ...(field ? {binding: field, field} : {}), fontSize: field === 'name' ? 50 : 32, font: 'sans-serif' as const, bold: false, italic: false, align: 'left' as const} : {}),
      ...(src ? {src} : {})};
    commit({...design, [side]: {...face, elements: [...face.elements, el]}}); select(el);
  }
  function select(el: CardElement) {
    setSelectedId(el.id); setTool(el.kind === 'text' ? 'text' : el.kind === 'image' ? 'image' : 'shape');
  }
  function remove() {
    if (!selected) return;
    commit({...design, [side]: {...face, elements: face.elements.filter(el => el.id !== selected.id)}}); setSelectedId(null);
  }
  function duplicate() {
    if (!selected || face.elements.length >= 50) return;
    const copy = {...selected, id: crypto.randomUUID(), x: Math.min(W - selected.width, selected.x + 20), y: Math.min(H - selected.height, selected.y + 20)};
    commit({...design, [side]: {...face, elements: [...face.elements, copy]}}); select(copy);
  }
  function reorder(direction: number) {
    const index = face.elements.findIndex(el => el.id === selectedId), next = index + direction;
    if (index < 0 || next < 0 || next >= face.elements.length) return;
    const elements = [...face.elements]; [elements[index], elements[next]] = [elements[next], elements[index]];
    commit({...design, [side]: {...face, elements}});
  }
  function undo() {
    if (!past.length) return;
    const previous = past[past.length - 1]; setPast(past.slice(0, -1)); setFuture(f => [design, ...f]); onChange(previous); const restored = previous[side].elements.at(-1); if (restored) select(restored); else setSelectedId(null);
  }
  function redo() {
    if (!future.length) return;
    setPast(p => [...p, design]); onChange(future[0]); const restored = future[0][side].elements.at(-1); if (restored) select(restored); else setSelectedId(null); setFuture(future.slice(1));
  }
  function pointerStart(e: React.PointerEvent, el: CardElement, resize = false) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); select(el); svg.current?.focus();
    drag.current = {pointer: e.pointerId, x: e.clientX, y: e.clientY, original: el, before: design, resize, moved: false};
    svg.current?.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId || !svg.current) return;
    const ratio = W / svg.current.getBoundingClientRect().width;
    const dx = (e.clientX - gesture.x) * ratio, dy = (e.clientY - gesture.y) * ratio;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    gesture.moved = true;
    const el = gesture.original;
    const moved = gesture.resize ? {...el, width: clamp(el.width + dx, 8, W - el.x), height: clamp(el.height + dy, 8, H - el.y)} :
      {...el, x: clamp(el.x + dx, 0, W - el.width), y: clamp(el.y + dy, 0, H - el.height)};
    onChange({...gesture.before, [side]: {...gesture.before[side], elements: gesture.before[side].elements.map(item => item.id === el.id ? moved : item)}});
  }
  function pointerEnd(e: React.PointerEvent, cancelled = false) {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    drag.current = null;
    if (cancelled) onChange(gesture.before);
    else if (gesture.moved) {setPast(p => [...p, gesture.before].slice(-40)); setFuture([]);}
    if (svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId);
  }
  async function uploadImage(file?: File) {
    if (!file) return;
    setError(''); setUploading(true); onProcessing(true);
    try {const src = await designImage(file); if (src.length > 2_500_000) throw new Error('画像が大きすぎます。小さい画像を選択してください。'); addImage.current(src);}
    catch (e: any) {setError(e.message);} finally {setUploading(false); onProcessing(false);}
  }
  function numeric(label: string, key: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'fontSize', min: number, max: number) {
    return <label className="min-w-0 text-xs font-medium">{label}<input aria-label={label} type="number" min={min} max={max} step="1" value={Math.round(selected?.[key] || 0)} className={control}
      onChange={e => {if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) updateElement({[key]: clamp(e.target.valueAsNumber, min, max)});}}/></label>;
  }
  return <div data-testid="card-designer" style={{'--card-ratio': W / H} as React.CSSProperties} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
      <div><h3 className="font-bold">名刺デザインメーカー</h3><p className="text-xs text-slate-500">{design.orientation === 'portrait' ? '55 × 91' : '91 × 55'}の比率 · 文字・図形・画像を自由に配置</p></div>
      <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs">名刺の向き<select aria-label="名刺の向き" value={design.orientation || 'landscape'} onChange={e => {commit(changeCardOrientation(design, e.target.value as CardOrientation)); setSelectedId(null); setZoom(1);}} className={`${control} mt-1`}><option value="landscape">横型（91 × 55）</option><option value="portrait">縦型（55 × 91）</option></select></label>
      <label className="text-xs">テンプレート<select aria-label="テンプレート" value="" onChange={e => {commit(initialCardDesign(e.target.value as 'basic' | 'band' | 'blank', design.orientation)); setSelectedId(null);}} className={`${control} mt-1`}><option value="" disabled>選択して適用</option><option value="basic">シンプル</option><option value="band">サイドライン</option><option value="blank">白紙から作る</option></select></label>
      </div>
    </div>
    {error && <p role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_164px]">
      <div className="order-2 min-w-0 space-y-3 border-t border-slate-200 p-3 lg:order-1 lg:border-t-0 lg:border-r lg:max-h-[max(320px,calc(100dvh-360px))] lg:overflow-y-auto" aria-label="編集パネル">
        <h4 className="text-sm font-bold">編集パネル</h4>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="編集ツール">
          {([{id: 'text', label: '文字', icon: Type}, {id: 'shape', label: '図形', icon: Copy}, {id: 'image', label: '画像', icon: ImagePlus}] as const).map(t => <button type="button" key={t.id} aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={`${btn} flex-col ${tool === t.id ? 'border-blue-400 bg-blue-50 text-blue-700' : ''}`}><t.icon className="h-4 w-4"/>{t.label}</button>)}
        </div>
        {tool === 'text' && <div className="space-y-2">
          <label className="block text-xs font-medium">追加する文字の種類<select aria-label="追加する文字の種類" value={textType} onChange={e => setTextType(e.target.value as CardBinding | 'custom')} className={`${control} mt-1`}>
            <option value="custom">自由な文字</option>{textFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select></label>
          <button type="button" onClick={() => add('text', undefined, textType === 'custom' ? undefined : textType)} className={`${btn} w-full`}>文字を追加</button>
          <p className="text-xs leading-relaxed text-slate-500">会社・所属、役職、連絡先などを選んで追加できます。</p>
        </div>}
        {tool === 'shape' && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => add('rect')} className={btn}>四角を追加</button><button type="button" onClick={() => add('ellipse')} className={btn}>円を追加</button></div>}
        {tool === 'image' && <label className={`${btn} w-full cursor-pointer`}>{uploading ? '画像を処理中…' : '画像を追加'}<input type="file" aria-label="デザイン画像" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="sr-only" onChange={e => {uploadImage(e.target.files?.[0]); e.target.value = '';}}/></label>}
        {selected ? <div className="space-y-3" data-testid="card-element-controls">
          <p className="text-xs text-slate-500">選択中：{selected.kind === 'text' ? fieldLabel(selected) || '文字' : selected.kind === 'image' ? '画像' : '図形'}</p>
          {selected.kind === 'text' && <>
            <label className="block text-xs font-medium">文字内容<textarea aria-label="文字内容" maxLength={2000} placeholder={fieldLabel(selected) || '文字を入力'} value={selected.binding ? card[selected.binding] : selected.text} onChange={e => updateElement({text: e.target.value, binding: undefined})} rows={3} className={`${control} mt-1 resize-y`}/></label>
            <label className="block text-xs font-medium">書体<select aria-label="書体" className={control} value={selected.font} onChange={e => updateElement({font: e.target.value as CardElement['font']})}><option value="sans-serif">ゴシック</option><option value="serif">明朝</option><option value="monospace">等幅</option></select></label>
            {numeric('文字サイズ', 'fontSize', 8, 160)}
            <div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={selected.bold} onClick={() => updateElement({bold: !selected.bold})} className={`${btn} ${selected.bold ? 'bg-blue-50 border-blue-400 text-blue-700' : ''}`}>太字</button><button type="button" aria-pressed={selected.italic} onClick={() => updateElement({italic: !selected.italic})} className={`${btn} ${selected.italic ? 'bg-blue-50 border-blue-400 text-blue-700' : ''}`}>斜体</button></div>
            <label className="block text-xs font-medium">文字揃え<select aria-label="文字揃え" className={control} value={selected.align} onChange={e => updateElement({align: e.target.value as CardElement['align']})}><option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option></select></label>
          </>}
          {selected.kind !== 'image' && <label className="flex items-center justify-between text-xs font-medium">色<input aria-label="要素の色" type="color" value={selected.color} onChange={e => updateElement({color: e.target.value})} className="h-9 w-14 rounded border border-slate-300 bg-white"/></label>}
          <div className="grid grid-cols-2 gap-2">{numeric('X位置', 'x', 0, W - selected.width)}{numeric('Y位置', 'y', 0, H - selected.height)}{numeric('幅', 'width', 8, W)}{numeric('高さ', 'height', 8, H)}</div>
          {numeric('回転角度', 'rotation', -180, 180)}
          <label className="block text-xs font-medium">不透明度<input aria-label="不透明度" type="range" min="0.1" max="1" step="0.1" value={selected.opacity} onChange={e => updateElement({opacity: Number(e.target.value)})} className="w-full"/></label>
          <button type="button" onClick={() => updateElement({x: (W - selected.width) / 2})} className={`${btn} w-full`}>名刺の中央に配置</button>
        </div> : <p className="text-xs leading-relaxed text-slate-500">名刺上または表示パネルの要素を選ぶと、文字・色・位置などを編集できます。</p>}
      </div>
      <div className="order-1 min-w-0 p-3 lg:order-2" aria-label="名刺キャンバスパネル">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1" role="group" aria-label="編集する面">{(['front', 'back'] as const).map(s => <button type="button" key={s} aria-pressed={side === s} onClick={() => {setSide(s); setSelectedId(null);}} className={`${btn} ${side === s ? 'border-blue-400 bg-blue-50 text-blue-700' : ''}`}>{s === 'front' ? 'オモテ面' : 'ウラ面'}</button>)}</div>
          <label className="flex items-center gap-2 text-xs">背景色<input type="color" aria-label="名刺の背景色" value={face.background} onChange={e => commit({...design, [side]: {...face, background: e.target.value}})} className="h-9 w-12 border border-slate-300 bg-white"/></label>
        </div>
        <div className="max-w-full overflow-auto rounded-xl border border-slate-300 bg-slate-200 p-3" style={{backgroundImage: 'radial-gradient(#b4bfce 1px, transparent 1px)', backgroundSize: '12px 12px'}}>
          <div className={`mx-auto w-full ${design.orientation === 'portrait' ? 'max-w-[calc(max(260px,100dvh-400px)*var(--card-ratio))]' : ''} lg:max-w-[calc(max(200px,100dvh-520px)*var(--card-ratio))]`}><div style={{width: `${zoom * 100}%`}} className="min-w-0 py-3">
            <svg ref={svg} data-testid="card-design-canvas" role="application" aria-label="名刺編集キャンバス" tabIndex={0} viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-hidden bg-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{aspectRatio: `${W} / ${H}`, touchAction: 'none'}}
              onPointerDown={e => {if (e.target === e.currentTarget) setSelectedId(null);}}
              onPointerMove={pointerMove} onPointerUp={e => pointerEnd(e)} onPointerCancel={e => pointerEnd(e, true)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {e.preventDefault(); e.shiftKey ? redo() : undo(); return;}
                if (e.key === 'Delete' || e.key === 'Backspace') {e.preventDefault(); remove();}
                const delta = e.shiftKey ? 10 : 1;
                if (selected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {e.preventDefault(); updateElement({x: selected.x + (e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0), y: selected.y + (e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0)});}
              }}>
              <rect width={W} height={H} fill={face.background} onPointerDown={() => setSelectedId(null)}/>
              {grid && <g pointerEvents="none" stroke="#cbd5e1" strokeWidth="1">{Array.from({length: Math.ceil(W / 50) + 1}, (_, i) => <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2={H}/>)}{Array.from({length: Math.ceil(H / 50) + 1}, (_, i) => <line key={`h${i}`} x1="0" y1={i * 50} x2={W} y2={i * 50}/>)}</g>}
              {face.elements.map(el => <g key={el.id} data-card-element={el.id} transform={elementTransform(el)} opacity={el.opacity} onPointerDown={e => pointerStart(e, el)} style={{cursor: 'move'}}>
                <CardElementArtwork element={el} card={card}/><rect width={el.width} height={el.height} fill="transparent"/>
                {selectedId === el.id && <rect width={el.width} height={el.height} fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
              </g>)}
              {guide && <rect data-testid="card-safe-area" x="30" y="30" width={W - 60} height={H - 60} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="8 6" pointerEvents="none"/>}
              {selected && <rect data-testid="card-resize-handle" x={selected.x + selected.width - 24} y={selected.y + selected.height - 24} width="24" height="24" fill="#2563eb" stroke="white" strokeWidth="2" onPointerDown={e => pointerStart(e, selected, true)} style={{cursor: 'nwse-resize'}}/>}
            </svg>
          </div></div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">ドラッグで移動／右下の青い四角でサイズ変更。数値入力でも調整できます。向きの変更時は要素を枠内に収めます。緑の点線は余白の目安です。</p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="キャンバス操作">
          <button type="button" onClick={undo} disabled={!past.length} aria-label="元に戻す" className={btn}><Undo2 className="h-4 w-4"/>戻る</button><button type="button" onClick={redo} disabled={!future.length} aria-label="やり直す" className={btn}><Redo2 className="h-4 w-4"/>進む</button>
          <button type="button" onClick={() => setZoom(z => Math.max(1, z - 0.25))} disabled={zoom <= 1} aria-label="縮小" className={btn}><ZoomOut className="h-4 w-4"/></button><button type="button" onClick={() => setZoom(z => Math.min(2.5, z + 0.25))} disabled={zoom >= 2.5} aria-label="拡大" className={btn}><ZoomIn className="h-4 w-4"/></button><button type="button" onClick={() => setZoom(1)} className={btn}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-pressed={grid} onClick={() => setGrid(v => !v)} className={btn}>グリッド</button><button type="button" aria-pressed={guide} onClick={() => setGuide(v => !v)} className={btn}>ガイド</button>
        </div>
      </div>
      <div className="order-3 min-w-0 border-t border-slate-200 p-3 lg:border-t-0 lg:border-l" aria-label="表示パネル">
        <h4 className="mb-2 text-sm font-bold">表示パネル</h4><p className="mb-2 text-xs text-slate-500">上ほど手前に表示</p>
        <div className="mb-3 grid grid-cols-2 gap-2"><button type="button" disabled={!selected} onClick={() => reorder(1)} aria-label="前面へ" className={btn}><ArrowUp className="h-4 w-4"/></button><button type="button" disabled={!selected} onClick={() => reorder(-1)} aria-label="背面へ" className={btn}><ArrowDown className="h-4 w-4"/></button><button type="button" disabled={!selected || face.elements.length >= 50} onClick={duplicate} aria-label="要素を複製" className={btn}><Copy className="h-4 w-4"/></button><button type="button" disabled={!selected} onClick={remove} aria-label="要素を削除" className={btn}><Trash2 className="h-4 w-4"/></button></div>
        <div className="max-h-64 space-y-1 overflow-y-auto" aria-label="重なり順">{[...face.elements].reverse().map((el, i) => <button type="button" key={el.id} data-card-layer={el.id} onClick={() => select(el)} aria-pressed={selectedId === el.id} className={`${btn} w-full justify-start text-left ${selectedId === el.id ? 'border-blue-400 bg-blue-50' : ''}`}><span className="shrink-0 text-slate-400">{i + 1}</span><span className="truncate">{el.kind === 'text' ? `${fieldLabel(el) ? fieldLabel(el) + '：' : ''}${(el.binding ? card[el.binding] : el.text) || '未入力'}` : el.kind === 'image' ? '画像' : el.kind === 'rect' ? '四角' : '円'}</span></button>)}</div>
        {!face.elements.length && <p className="text-xs text-slate-500">要素を追加してください。</p>}
      </div>
    </div>
  </div>;
}
