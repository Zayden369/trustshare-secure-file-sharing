// Presentation-only palettes. API values and calculations are unchanged.
export const CHART_THEMES = {
  light: {
    series:['#4f46e5','#0f766e','#a16207','#64748b','#9f596b','#85858f'],
    gridStroke:'#e5e5e5',axisTickFill:'#666',axisTickFontSize:12,
    tooltipBg:'#fff',tooltipBorder:'#ddd',tooltipShadow:'0 6px 20px #0001',tooltipLabelColor:'#666',tooltipValueColor:'#111',
    storageStroke:'#4f46e5',storageGradStart:'rgba(20,20,20,.12)',storageGradEnd:'rgba(20,20,20,0)',storageDotFill:'#111',
    uploadFill:'#4f46e5',downloadFill:'#0f766e',successStroke:'#171717',failedStroke:'#777',failedDotFill:'#777',progressFrom:'#111',progressTo:'#777',
  },
  dark: {
    series:['#a5b4fc','#5cc8b2','#d9b777','#a0a4af','#c98ea0','#777983'],
    gridStroke:'#292929',axisTickFill:'#aaa',axisTickFontSize:12,
    tooltipBg:'#181818',tooltipBorder:'#444',tooltipShadow:'0 6px 20px #0004',tooltipLabelColor:'#aaa',tooltipValueColor:'#f5f5f5',
    storageStroke:'#a5b4fc',storageGradStart:'rgba(240,240,240,.12)',storageGradEnd:'rgba(240,240,240,0)',storageDotFill:'#eee',
    uploadFill:'#a5b4fc',downloadFill:'#5cc8b2',successStroke:'#eee',failedStroke:'#999',failedDotFill:'#999',progressFrom:'#eee',progressTo:'#777',
  },
};
export function seriesTone(index,theme='dark'){
  const tones=theme==='light'?['#4f46e5','#0f766e','#a16207','#64748b','#9f596b','#85858f']:['#a5b4fc','#5cc8b2','#d9b777','#a0a4af','#c98ea0','#777983'];
  return tones[index%tones.length];
}
