// Presentation-only palettes. API values and calculations are unchanged.
export const CHART_THEMES = {
  light: {
    series:['#171717','#777','#aaa','#444','#ccc','#666'],
    gridStroke:'#e5e5e5',axisTickFill:'#666',axisTickFontSize:12,
    tooltipBg:'#fff',tooltipBorder:'#ddd',tooltipShadow:'0 6px 20px #0001',tooltipLabelColor:'#666',tooltipValueColor:'#111',
    storageStroke:'#111',storageGradStart:'rgba(20,20,20,.12)',storageGradEnd:'rgba(20,20,20,0)',storageDotFill:'#111',
    uploadFill:'#171717',downloadFill:'#aaa',successStroke:'#171717',failedStroke:'#777',failedDotFill:'#777',progressFrom:'#111',progressTo:'#777',
  },
  dark: {
    series:['#eee','#888','#bbb','#555','#ddd','#707070'],
    gridStroke:'#292929',axisTickFill:'#aaa',axisTickFontSize:12,
    tooltipBg:'#181818',tooltipBorder:'#444',tooltipShadow:'0 6px 20px #0004',tooltipLabelColor:'#aaa',tooltipValueColor:'#f5f5f5',
    storageStroke:'#eee',storageGradStart:'rgba(240,240,240,.12)',storageGradEnd:'rgba(240,240,240,0)',storageDotFill:'#eee',
    uploadFill:'#eee',downloadFill:'#666',successStroke:'#eee',failedStroke:'#999',failedDotFill:'#999',progressFrom:'#eee',progressTo:'#777',
  },
};
export function seriesTone(index,theme='dark'){
  const tones=theme==='light'?['#171717','#777','#aaa','#444','#ccc','#666']:['#eee','#888','#bbb','#555','#ddd','#707070'];
  return tones[index%tones.length];
}
