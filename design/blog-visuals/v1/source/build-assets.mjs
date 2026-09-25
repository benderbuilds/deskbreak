import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fontkit = require('next/dist/compiled/@next/font/dist/fontkit').default;
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '../../..');
const C = { paper: '#F7F9FC', white: '#FFFFFF', ink: '#18233D', muted: '#536078', blue: '#3155D9', soft: '#EDF0FF', yellow: '#FFE08A', line: '#DCE2EC', teal: '#09A1A1' };
const studyData = JSON.parse(await fs.readFile(path.join(here, 'study-data.json'), 'utf8'));
const sittingDifferences = studyData.sources.find(s => s.id === 'edwardson-2022').differences;
await fs.mkdir(path.join(here, 'fonts'), { recursive: true });
for (const name of ['Archivo-Medium.ttf', 'Archivo-ExtraBold.ttf', 'LICENSE.txt']) {
  const target = path.join(here, 'fonts', name);
  try { await fs.access(target); } catch { await fs.copyFile(path.join(repo, 'src/app/og-fonts', name), target); }
}
const fonts = {
  500: fontkit(await fs.readFile(path.join(here, 'fonts/Archivo-Medium.ttf'))),
  800: fontkit(await fs.readFile(path.join(here, 'fonts/Archivo-ExtraBold.ttf'))),
};
let editable = false;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const rect = (x,y,w,h,fill,r=0,stroke='none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const line = (x1,y1,x2,y2,color=C.line,width=2,dash='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
const circle = (x,y,r,fill,stroke='none',sw=0) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
function width(str, size, weight=500) {
  const f=fonts[weight]; return f.layout(str).positions.reduce((s,p)=>s+p.xAdvance,0)*size/f.unitsPerEm;
}
function text(str,x,y,size=28,fill=C.ink,weight=500,align='left') {
  if (align==='center') x-=width(str,size,weight)/2;
  if (align==='right') x-=width(str,size,weight);
  if (editable) return `<text x="${x}" y="${y}" font-family="Archivo, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(str)}</text>`;
  const f=fonts[weight], run=f.layout(str), scale=size/f.unitsPerEm;
  let cursor=0;
  const paths=run.glyphs.map((g,i)=>{const p=run.positions[i]; const out=`<path d="${g.path.toSVG()}" transform="translate(${cursor+p.xOffset} ${p.yOffset})"/>`;cursor+=p.xAdvance;return out;}).join('');
  return `<g fill="${fill}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" aria-hidden="true">${paths}</g>`;
}
function wrap(str,max,size=28,weight=500) {
  const lines=[]; let row='';
  for(const word of str.split(' ')){const next=row ? `${row} ${word}` : word;if(row && width(next,size,weight)>max){lines.push(row);row=word;}else row=next;}
  if(row) lines.push(row); return lines;
}
function para(str,x,y,max,size=28,fill=C.ink,weight=500,leading=1.35) {
  return wrap(str,max,size,weight).map((s,i)=>text(s,x,y+i*size*leading,size,fill,weight)).join('');
}
function pill(str,x,y,fill=C.soft,color=C.blue,size=25) {
  const w=width(str,size,800)+32; return rect(x,y,w,46,fill,23)+text(str,x+16,y+32,size,color,800);
}
function icon(name,x,y,s=100) {
  const k=s/100; let parts='';
  if(name==='clock') parts=circle(50,50,35,'none',C.ink,4)+line(50,50,50,25,C.blue,5)+line(50,50,70,61,C.blue,5)+circle(50,50,4,C.ink);
  if(name==='window') parts=rect(11,15,78,68,C.white,6,C.ink)+line(50,15,50,83,C.ink,3)+line(11,49,89,49,C.ink,3)+circle(72,32,9,C.yellow)+`<path d="M17 74L33 59L46 71M56 71L65 62L83 77" fill="none" stroke="${C.blue}" stroke-width="3"/>`;
  if(name==='timer') parts=circle(50,57,30,'none',C.ink,4)+line(41,13,59,13,C.ink,5)+line(50,13,50,25,C.ink,4)+line(50,57,66,40,C.blue,5)+circle(50,57,4,C.blue);
  if(name==='desk') parts=rect(33,14,40,27,C.soft,3,C.ink)+line(53,41,53,48,C.ink,3)+line(19,52,89,52,C.blue,5)+line(25,54,25,90,C.ink,4)+line(83,54,83,90,C.ink,4)+line(35,48,71,48,C.ink,3);
  if(name==='programme') parts=rect(20,12,60,78,C.white,6,C.ink)+rect(35,6,30,15,C.yellow,4)+line(41,37,65,37,C.ink,3)+line(41,56,65,56,C.ink,3)+line(41,75,65,75,C.ink,3)+[37,56,75].map(z=>circle(31,z,4,C.blue)).join('');
  if(name==='people') parts=circle(34,29,12,C.yellow,C.ink,3)+circle(70,33,10,C.soft,C.ink,3)+`<path d="M12 81V65Q12 48 34 48Q56 48 56 65V81M62 55Q89 55 89 71V81" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${k})">${parts}</g>`;
}
function shell(a,m,h,body){
  const w=m?600:1200,p=m?36:56;
  const titleSize=m?43:58;
  const titleLines=wrap(a.title,w-2*p,titleSize,800);
  const title=titleLines.map((s,i)=>text(s,p,140+i*(m?50:67),titleSize,C.ink,800)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(a.title)}</title><desc id="desc">${esc(a.alt)}</desc>${rect(0,0,w,h,C.paper)}${rect(0,0,12,h,C.blue)}${text('DeskBreak',p,58,27,C.blue,800)}${text(a.label,w-p,58,24,C.muted,500,'right')}${title}${body}${line(p,h-88,w-p,h-88)}${text(a.sourceLine,p,h-45,m?22:25,C.muted)}${circle(w-p-7,h-48,7,C.yellow)}</svg>`;
}
const sources={
  walking:{id:'dunstan-2012',label:'Dunstan et al. (2012)',url:'https://doi.org/10.2337/dc11-1931'},
  eyes:{id:'talens-estarelles-2023',label:'Talens-Estarelles et al. (2023)',url:'https://doi.org/10.1016/j.clae.2022.101744'},
  desk:{id:'edwardson-2022',label:'Edwardson et al. (2022)',url:'https://doi.org/10.1136/bmj-2021-069288'},
};
const assets=[
  {
    id:'break-frequency-protocol',title:'A study of short walking breaks',label:'What people did',sourceLine:'Dunstan et al. (2012), Diabetes Care',
    postSlug:'how-often-should-you-get-up-from-your-desk',
    placement:{afterHeading:'Every 20 minutes: the lab study',afterParagraphStartsWith:'One of the most cited studies on breaking up sitting'},sourceIds:[sources.walking.id],
    alt:'Nineteen adults each tried sitting without breaks, light walking breaks, and moderate walking breaks in a lab.',
    caption:'Researchers tested 2-minute walks every 20 minutes. This small lab study did not identify the best break schedule or test DeskBreak routines.',
    longDescription:['The same 19 adults tried all three options on separate days. They were aged 45 to 65 and had overweight or obesity. The order of the options was assigned by chance.','Each visit began with two hours of sitting and a test drink. Researchers then tracked five hours of sitting without breaks, or sitting with two-minute walks every 20 minutes.','Blood tests measured glucose, also called blood sugar, and insulin, a hormone that helps control blood sugar. Each walking day included 14 walks, totaling 28 minutes. The three rows compare the options; they do not show every break.'],
    dimensions:{desktop:[1200,840],mobile:[600,1160]},
    draw(m){const p=m?36:56,w=m?528:1088;let b=para('19 adults tried each of these three options.',p,m?267:223,w,m?29:31,C.muted);
      const rows=[['Sitting without breaks','Stayed seated',C.line],['Light walking breaks','Walked for 2 minutes every 20 minutes',C.blue],['Moderate walking breaks','Walked for 2 minutes every 20 minutes',C.ink]];
      rows.forEach(([title,sub,color],i)=>{const y=(m?322:273)+i*(m?198:135);b+=rect(p,y,w,m?174:114,C.white,16)+rect(p,y,8,m?174:114,color,4);
        b+=text(title,p+28,y+47,m?32:34,C.ink,800);
        b+=para(sub,p+28,y+(m?92:85),m?470:760,m?27:28,C.muted);
      });
      b+=para('Measured: blood sugar and insulin after a test drink.',p,m?955:727,w,m?28:30,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'break-frequency-interpretation',title:'What this walking study tells us',label:'What it means',sourceLine:'Study context: Dunstan et al. (2012)',
    postSlug:'how-often-should-you-get-up-from-your-desk',placement:{afterHeading:'Every 20 minutes: the lab study',afterParagraphStartsWith:'Keep the limits in view.'},sourceIds:[sources.walking.id],
    alt:'The study tested walking breaks and blood sugar over a few hours in a lab. It did not test desk stretches or long-term health.',
    caption:'The study tells us about short walks and blood test results over a few hours. It leaves the best break timing and long-term health effects unanswered.',
    longDescription:['The activity was walking. The study did not test desk stretches or DeskBreak routines.','The same 19 adults took part on separate days in a lab. The study did not follow their normal workdays for months.','Researchers measured blood sugar and insulin after a test drink. They did not measure long-term health effects.','The study tested one break interval: every 20 minutes. It did not compare that timing with other schedules.'],dimensions:{desktop:[1200,880],mobile:[600,1270]},
    draw(m){const p=m?36:56;let b='';const rows=[['Activity','Walking breaks','Desk stretches'],['Time','A few hours in a lab','Months of desk work'],['Result','Blood sugar and insulin','Long-term health']];
      if(!m){b+=text('What it tested',p+250,240,28,C.blue,800)+text('What it did not test',p+630,240,28,C.muted,800);}
      rows.forEach(([label,left,right],i)=>{const y=(m?282:280)+i*(m?226:140);b+=line(p,y+(m?204:119),m?564:1144,y+(m?204:119));
        if(m){b+=pill(label,p,y,C.yellow,C.ink,25)+text(left,p,y+98,29,C.blue,800)+text(`Did not test: ${right.toLowerCase()}`,p,y+153,26,C.muted);}
        else{b+=text(label,p,y+56,30,C.ink,800)+para(left,p+250,y+40,310,30,C.blue,800)+para(right,p+630,y+40,390,30,C.muted);}
      });
      const by=m?1020:730;b+=rect(p,by-43,m?528:1088,m?128:62,C.yellow,12)+para('It did not find the best break timing for everyone.',p+20,by,m?486:1048,m?28:30,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'eye-break-mnemonic',title:'The 20-20-20 reminder',label:'How it works',sourceLine:'Talens-Estarelles et al. (2023)',
    postSlug:'does-the-20-20-20-rule-work',placement:{afterHeading:null,afterParagraphStartsWith:'The 20-20-20 rule is simple:'},sourceIds:[sources.eyes.id],
    alt:'Every 20 minutes, look away from the screen at something about 20 feet away for 20 seconds. Twenty feet is about six meters.',
    caption:'An easy way to remember a screen break. The study tested these numbers together; it did not show they were better than other timings or distances.',
    longDescription:['Every 20 minutes, look away from your screen.','Choose something about 20 feet away, roughly six meters.','Look at it for 20 seconds.','These are the numbers in the familiar 20-20-20 rule. The study did not test whether a different interval, distance or duration worked better.'],dimensions:{desktop:[1200,830],mobile:[600,1190]},
    draw(m){const p=m?36:56;let b=para('Look away from your screen.',p,m?256:217,m?528:1088,m?29:31,C.muted);
      const steps=[['clock','Every','minutes'],['window','Look at something','feet away'],['timer','For','seconds']];
      steps.forEach(([ic,lead,unit],i)=>{const x=m?p:p+i*371,y=m?315+i*220:265,cw=m?528:344,ch=m?197:338;b+=rect(x,y,cw,ch,i===1?C.soft:C.white,18);
        if(m){b+=icon(ic,x+23,y+43,104)+text(lead,x+161,y+45,27,C.muted)+text('20',x+155,y+131,100,C.blue,800)+text(unit,x+298,y+130,28,C.ink,800);if(i===1)b+=text('about 6 meters',x+163,y+172,25,C.muted);}
        else{b+=icon(ic,x+239,y+66,72)+text(lead,x+26,y+54,27,C.muted)+text('20',x+23,y+205,148,C.blue,800)+text(unit,x+28,y+270,34,C.ink,800);if(i===1)b+=text('about 6 meters',x+28,y+308,25,C.muted);}
      });
      b+=para('The study did not test other timings.',p,m?1042:692,m?528:1030,m?28:31,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'eye-break-study',title:'Eye breaks: what one study found',label:'One small study',sourceLine:'Talens-Estarelles et al. (2023)',
    postSlug:'does-the-20-20-20-rule-work',placement:{afterHeading:'The study',afterParagraphStartsWith:'Researchers recruited 29 computer users'},sourceIds:[sources.eyes.id],
    alt:'Twenty-nine computer users with eye strain spent two weeks without reminders, two weeks with reminders, and one week after reminders stopped.',
    caption:'People reported less eye strain during reminders. Because everyone followed the same sequence, the study cannot show how much of the change came from the reminders.',
    longDescription:['The study followed 29 computer users who already had eye strain.','Researchers first tracked two weeks without reminders. Next came two weeks of 20-20-20 reminders, then one week after the reminders stopped.','People reported fewer symptoms during reminders. It was unclear whether that improvement lasted after the reminders stopped.','Tests for signs of dry eye did not improve. Most other eye tests did not change either, but one focusing test improved. This was accommodative facility, a measure of how readily the eyes change focus.','All 29 people followed the same sequence. There was no separate group for comparison, and the study did not test different break schedules.'],dimensions:{desktop:[1200,950],mobile:[600,1390]},
    draw(m){const p=m?36:56;let b=pill('29 computer users with eye strain',p,m?286:208,C.yellow,C.ink,m?24:28);
      const periods=[['2 weeks','Before reminders','No prompts yet',C.line],['2 weeks','With reminders','20-20-20 prompts',C.blue],['1 week','Reminders stopped','Checked again',C.ink]];
      periods.forEach(([dur,title,sub,color],i)=>{const x=m?p:p+i*371,y=m?372+i*184:302,cw=m?528:344,ch=m?158:271;b+=rect(x,y,cw,ch,C.white,16)+rect(x,y,cw,9,color,3);
        if(m){b+=text(dur,x+24,y+47,35,color===C.line?C.ink:color,800)+text(title,x+24,y+94,28,C.ink,800)+text(sub,x+24,y+134,25,C.muted);}
        else{b+=text(dur,x+24,y+73,49,color===C.line?C.ink:color,800)+para(title,x+24,y+138,296,30,C.ink,800)+text(sub,x+24,y+237,26,C.muted);}
      });
      const y=m?984:653;b+=para('People reported less eye strain during reminders.',p,y,m?528:1030,m?29:32,C.blue,800)+para('It is unclear if the improvement lasted after reminders stopped.',p,y+(m?102:66),m?528:1030,m?28:31,C.ink);
      b+=para('Everyone followed the same sequence. No separate comparison group.',p,m?1230:826,m?528:1050,m?25:28,C.muted);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'standing-desk-trial',title:'The study tested desks with support',label:'Three groups',sourceLine:'Edwardson et al. (2022), BMJ',
    postSlug:'are-standing-desks-worth-it',placement:{afterHeading:'A bigger trial, a year long',afterParagraphStartsWith:'A 2022 trial published in the BMJ gave firmer numbers'},sourceIds:[sources.desk.id],
    alt:'The trial compared usual work habits, support to sit less, and the same support plus an adjustable desk in 756 UK office workers.',
    caption:'Everyone who received a desk also received support to sit less. This trial cannot tell us what a desk alone would do.',
    longDescription:['The study included 756 UK local-government office workers in 78 workplace groups. Each workplace group was assigned by chance to one of three options.','One option was usual work habits. Another was a support program called SMART Work and Life, or SWAL. The third was the same support plus a height-adjustable desk.','The program used steps such as education, goals and reminders to help people sit less.','Researchers compared daily sitting time after 12 months, including time at work and outside work. Nobody received a desk without the support program.'],dimensions:{desktop:[1200,980],mobile:[600,1320]},
    draw(m){const p=m?36:56;let b=para('756 UK office workers in 78 workplace groups.',p,m?279:250,m?528:1088,m?28:31,C.muted);
      const arms=[['people','Usual work habits','No sit-less program'],['programme','Support to sit less','Education, goals and reminders'],['desk','Support + desk','Same support, plus an adjustable desk']];
      arms.forEach(([ic,title,sub],i)=>{const x=m?p:p+i*371,y=m?357+i*216:310,cw=m?528:344,ch=m?190:355;b+=rect(x,y,cw,ch,i===2?C.soft:C.white,18);
        if(m){b+=icon(ic,x+22,y+50,94)+para(title,x+139,y+55,359,32,C.ink,800)+para(sub,x+139,y+124,353,26,C.muted);}
        else{b+=icon(ic,x+24,y+22,102)+para(title,x+24,y+181,296,34,C.ink,800)+para(sub,x+24,y+268,296,27,C.muted);}
      });
      b+=pill('Compared after 12 months',p,m?1040:718,C.yellow,C.ink,m?27:30)+para('No group received only a desk.',p,m?1147:828,m?528:1088,m?30:35,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'standing-desk-results',title:'How much less did people sit?',label:'After 12 months',sourceLine:'Edwardson et al. (2022), BMJ, Table 2',
    postSlug:'are-standing-desks-worth-it',placement:{afterHeading:'A bigger trial, a year long',afterParagraphStartsWith:'At twelve months, the group with the desk'},sourceIds:[sources.desk.id],
    alt:'After 12 months, people receiving support sat an estimated 22.2 minutes less per day than those with usual work habits. Support plus a desk: 63.7 minutes less.',
    caption:'About 22 minutes less sitting per day with support, or 64 minutes with support plus a desk, compared with usual work habits after 12 months. These are estimates for groups, not a promised result for each person.',
    longDescription:['Support to sit less: the estimate was 22.2 fewer minutes per day than usual work habits. Its 95% confidence interval was 5.7 to 38.8 fewer minutes.','Support plus a desk: the estimate was 63.7 fewer minutes per day. Its 95% confidence interval was 47.4 to 80.1 fewer minutes.','Each dot shows the estimate. Each bar shows the uncertainty around it, using a statistical range called a 95% confidence interval. The bars do not show the range of individual results.','Researchers adjusted these group comparisons for factors such as starting sitting time. The numbers compare groups after 12 months; they are not changes from the start for each person.','Daily sitting includes work and time outside work. The trial did not test a desk on its own, and these sitting-time results do not establish a long-term health benefit or a result for DeskBreak.'],
    dataTable:{caption:'Daily sitting compared with usual work habits after 12 months',columns:['Group','Difference (minutes/day)','95% confidence interval: lower','95% confidence interval: upper'],rows:sittingDifferences.map((d,i)=>[i?'Support + desk (SWAL)':'Support to sit less (SWAL)',d.estimate,d.ci95Lower,d.ci95Upper]),note:'A minus sign means less sitting. These are the adjusted group differences published in Table 2. SWAL means SMART Work and Life, the support program. Daily sitting includes time at work and outside work.'},
    dimensions:{desktop:[1200,1020],mobile:[600,1240]},
    draw(m){const p=m?36:56;let b=para('Fewer minutes of sitting each day',p,m?275:224,m?528:1088,m?29:32,C.ink,800)+para('Compared with usual work habits',p,m?323:270,m?528:1088,m?27:29,C.muted);
      const x0=m?60:384,x1=m?548:1112,top=m?480:344,bottom=m?766:628,scale=v=>x0+v/90*(x1-x0);
      for(const tick of [0,15,30,45,60,75,90])b+=line(scale(tick),top-35,scale(tick),bottom+30,tick===0?C.muted:C.line,tick===0?3:2)+text(String(tick),scale(tick),bottom+73,m?25:26,C.muted,500,'center');
      const groups=sittingDifferences.map((d,i)=>[i?'Support + desk':'Support to sit less',-d.estimate,-d.ci95Upper,-d.ci95Lower,i?C.blue:C.ink]);
      groups.forEach(([label,val,lo,hi,color],i)=>{const y=m?493+i*250:382+i*205;
        if(m)b+=text(label,p,y-76,30,color,800)+text(`${val} min`,564,y-76,30,color,800,'right');
        else b+=para(label,p,y-36,280,33,color,800)+text(`${val} min less`,p,y+70,30,color,800);
        b+=line(scale(lo),y,scale(hi),y,color,8)+line(scale(lo),y-16,scale(lo),y+16,color,4)+line(scale(hi),y-16,scale(hi),y+16,color,4)+circle(scale(val),y,14,color)+circle(scale(val),y,5,C.white);
        b+=text(`Range: ${lo} to ${hi}`,m?p:scale(lo),y+62,m?27:26,C.muted);
      });
      const y=m?916:787;b+=para('Dots = estimates. Bars = uncertainty.',p,y,m?528:1088,m?27:28,C.muted)+para('Ranges are 95% confidence intervals.',p,y+(m?83:46),m?528:1088,m?26:27,C.muted)+para('Includes sitting at work and outside work.',p,y+(m?162:97),m?528:1088,m?28:30,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
];

for(const dir of ['svg','webp','preview','source/editable'])await fs.mkdir(path.join(root,dir),{recursive:true});
const manifest={version:'1.1.0',createdAt:'2026-09-25',publicBasePath:'/blog/figures/v1',assets:[]};
for(const asset of assets){
  const {draw,dimensions,...meta}=asset;
  delete meta.label;
  delete meta.sourceLine;
  const entry={...meta,sourceChecked:true,clinicallyReviewed:false,files:{}};
  for(const mode of ['desktop','mobile']){
    const m=mode==='mobile',name=`${asset.id}--${mode}`;
    editable=false;const svg=draw.call(asset,m);
    const svgPath=`svg/${name}.svg`,webpPath=`webp/${name}.webp`;
    await fs.writeFile(path.join(root,svgPath),svg);
    await sharp(Buffer.from(svg)).webp({quality:86,effort:6}).toFile(path.join(root,webpPath));
    editable=true;await fs.writeFile(path.join(root,'source/editable',`${name}.svg`),draw.call(asset,m));
    entry.files[mode]={svg:svgPath,webp:webpPath,width:dimensions[mode][0],height:dimensions[mode][1]};
  }
  manifest.assets.push(entry);
}
await fs.writeFile(path.join(root,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');

const galleryStyle=`@font-face{font-family:Archivo;src:url(source/fonts/Archivo-Medium.ttf);font-weight:500}@font-face{font-family:Archivo;src:url(source/fonts/Archivo-ExtraBold.ttf);font-weight:800}*{box-sizing:border-box}body{margin:0;background:${C.paper};color:${C.ink};font:500 17px/1.6 Archivo,Arial,sans-serif}header{background:${C.ink};color:white;padding:56px max(24px,calc((100vw - 1100px)/2))}header p{max-width:760px;color:#DCE2EC}h1{font-weight:800;font-size:clamp(30px,4vw,48px);line-height:1.1;max-width:850px}main{max-width:1160px;padding:24px;margin:auto}h2{font-size:28px;line-height:1.2}article{padding:36px 0;border-bottom:1px solid ${C.line}}picture,img{display:block;width:100%;height:auto}figure{margin:24px 0}figcaption{font-size:16px;color:${C.muted};margin-top:12px}a{color:${C.blue}}header a{color:${C.yellow}}.links{display:flex;gap:20px;flex-wrap:wrap}details{margin-top:20px}summary{cursor:pointer;font-weight:800}table{border-collapse:collapse;width:100%;margin-top:18px;font-size:15px}td,th{padding:10px;text-align:left;border-bottom:1px solid ${C.line}}.table-scroll{overflow:auto}a:focus-visible,summary:focus-visible{outline:3px solid ${C.blue};outline-offset:4px}code{font-size:.86em}nav{display:flex;gap:18px;flex-wrap:wrap}@media(max-width:640px){main{padding:16px}header{padding:32px 20px}article{padding:24px 0}h2{font-size:24px}}`;
const tableMarkup=a=>a.dataTable?`<div class="table-scroll"><table><caption>${esc(a.dataTable.caption)}</caption><thead><tr>${a.dataTable.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${a.dataTable.rows.map(r=>`<tr>${r.map((v,i)=>i===0?`<th scope="row">${esc(v)}</th>`:`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${esc(a.dataTable.note)}</p>`:'';
const articles=manifest.assets.map(a=>`<article id="${a.id}"><h2>${esc(a.title)}</h2><p>For <a href="https://deskbreak.co/blog/${a.postSlug}">${esc(a.postSlug.replaceAll('-',' '))}</a></p><figure><picture><source media="(max-width:640px)" srcset="${a.files.mobile.webp}" width="${a.files.mobile.width}" height="${a.files.mobile.height}"><img src="${a.files.desktop.webp}" width="${a.files.desktop.width}" height="${a.files.desktop.height}" alt="${esc(a.alt)}" loading="lazy"></picture><figcaption>${esc(a.caption)} <span>Source: ${a.sourceIds.map(id=>{const s=Object.values(sources).find(v=>v.id===id);return `<a href="${s.url}">${s.label}</a>`;}).join(', ')}.</span></figcaption></figure><nav aria-label="${esc(a.title)} files"><a href="${a.files.desktop.svg}">Desktop SVG</a><a href="${a.files.mobile.svg}">Mobile SVG</a><a href="source/editable/${a.id}--desktop.svg">Editable master</a></nav><details><summary>Read the figure details</summary>${a.longDescription.map(p=>`<p>${esc(p)}</p>`).join('')}${tableMarkup(a)}</details></article>`).join('');
await fs.writeFile(path.join(root,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeskBreak research figures</title><style>${galleryStyle}</style></head><body><header><p>DeskBreak editorial assets / Version 1.1</p><h1>Research, made easier to understand.</h1><p>Six figures explain what researchers tested, what they found, and what remains uncertain. Each has a separate phone layout, a source link and a text explanation.</p><nav><a href="README.md">Developer handoff</a><a href="asset-manifest.json">Asset manifest</a><a href="SOURCES.md">Source checks</a><a href="COPY-STANDARD.md">Writing standard</a></nav></header><main>${articles}</main></body></html>`);

const boards=[];
for(let i=0;i<manifest.assets.length;i++){
  const b=await sharp(path.join(root,manifest.assets[i].files.desktop.webp)).resize(600,480,{fit:'contain',background:C.paper}).png().toBuffer();
  boards.push({input:b,left:24+(i%2)*624,top:24+Math.floor(i/2)*504});
}
await sharp({create:{width:1272,height:1536,channels:3,background:C.line}}).composite(boards).png().toFile(path.join(root,'preview/contact-sheet.png'));
const mobileBoards=[];
for(let i=0;i<manifest.assets.length;i++){
  const b=await sharp(path.join(root,manifest.assets[i].files.mobile.webp)).resize(360,800,{fit:'contain',background:C.paper}).png().toBuffer();
  mobileBoards.push({input:b,left:16+(i%3)*376,top:16+Math.floor(i/3)*816});
}
await sharp({create:{width:1144,height:1648,channels:3,background:C.line}}).composite(mobileBoards).png().toFile(path.join(root,'preview/mobile-contact-sheet.png'));
const fontCss=(await Promise.all([['Archivo-Medium.ttf',500],['Archivo-ExtraBold.ttf',800]].map(async([name,weight])=>`@font-face{font-family:Archivo;src:url(data:font/ttf;base64,${(await fs.readFile(path.join(here,'fonts',name))).toString('base64')});font-weight:${weight}}`))).join('');
editable=true;
const pages=assets.map(a=>`<section data-document-role="page" data-label="${esc(a.title)}" style="width:1200px;height:${a.dimensions.desktop[1]}px;overflow:hidden">${a.draw(false)}</section>`).join('');
await fs.writeFile(path.join(here,'canva-import.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${fontCss}body{margin:0}section{margin:0;break-after:page}</style><title>DeskBreak research figures</title></head><body>${pages}</body></html>`);
const summary=await Promise.all(manifest.assets.map(async a=>({id:a.id,desktopWebpBytes:(await fs.stat(path.join(root,a.files.desktop.webp))).size,mobileWebpBytes:(await fs.stat(path.join(root,a.files.mobile.webp))).size})));
console.log(JSON.stringify({figures:manifest.assets.length,variants:manifest.assets.length*2,summary},null,2));
