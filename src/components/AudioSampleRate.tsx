import { useLabel } from '../i18n/enhanced';

const rates = [8000,12000,16000,22050,24000,32000,44100,48000,88200,96000,192000];

export default function AudioSampleRate({value, onChange, disabled = false}: {value:number; onChange:(value:number)=>void; disabled?:boolean}) {
  const label = useLabel();
  return <select aria-label={label('音频采样率', 'Audio sample rate')} className="select-field" value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}>
    <option value={0}>{label('自动 · 跟随源文件', 'Auto · follow source')}</option>
    {rates.map(rate=><option key={rate} value={rate}>{rate} Hz</option>)}
    {value > 0 && !rates.includes(value) && <option value={value}>{value} Hz</option>}
  </select>;
}
