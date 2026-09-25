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
    id:'break-frequency-protocol',title:'A walking-break experiment',label:'Study design',sourceLine:'Dunstan et al. (2012), Diabetes Care',
    postSlug:'how-often-should-you-get-up-from-your-desk',
    placement:{afterHeading:'Every 20 minutes: the lab study',afterParagraphStartsWith:'One of the most cited studies on breaking up sitting'},sourceIds:[sources.walking.id],
    alt:'The same 19 adults completed three laboratory conditions: uninterrupted sitting, light walking breaks, and moderate walking breaks.',
    caption:'This experiment compared walking schedules in a laboratory. It did not test DeskBreak routines or establish a universal break interval.',
    longDescription:['Nineteen adults aged 45 to 65 with overweight or obesity completed all three conditions in a randomized crossover trial.','After an initial seated period and a test drink, participants completed five hours of uninterrupted sitting or sitting interrupted by two-minute light or moderate walks every 20 minutes.','The researchers measured post-drink glucose and insulin. The walking conditions included 14 breaks totaling 28 minutes; the diagram is a comparison of conditions, not a complete time axis.'],
    dimensions:{desktop:[1200,840],mobile:[600,1120]},
    draw(m){const p=m?36:56,w=m?528:1088;let b=para('The same 19 adults tried all three conditions.',p,m?267:223,w,m?29:31,C.muted);
      const rows=[['Uninterrupted sitting','No scheduled walking breaks',C.line],['Light walking','2-minute walk every 20 minutes',C.blue],['Moderate walking','2-minute walk every 20 minutes',C.ink]];
      rows.forEach(([title,sub,color],i)=>{const y=(m?322:273)+i*(m?198:135);b+=rect(p,y,w,m?174:114,C.white,16)+rect(p,y,8,m?174:114,color,4);
        b+=text(title,p+28,y+47,m?32:34,C.ink,800);
        b+=para(sub,p+28,y+(m?92:85),m?470:760,m?27:28,C.muted);
        if(!m){const xx=920;for(let j=0;j<4;j++)b+=rect(xx+j*42,y+40,28,34,i?color:C.line,7);}
      });
      b+=para('Measured: glucose and insulin after a test drink.',p,m?955:727,w,m?28:30,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'break-frequency-interpretation',title:'Keep the finding in context',label:'Reading research',sourceLine:'Study context: Dunstan et al. (2012)',
    postSlug:'how-often-should-you-get-up-from-your-desk',placement:{afterHeading:'Every 20 minutes: the lab study',afterParagraphStartsWith:'Keep the limits in view.'},sourceIds:[sources.walking.id],
    alt:'The experiment tested walking, short laboratory sessions, and blood markers. It did not test stretching, a universal schedule, or long-term health outcomes.',
    caption:'A result applies first to the people, activity and outcome that were actually studied. A different routine needs its own evidence.',
    longDescription:['Activity: the experiment tested light and moderate walking, not stretching or a guided DeskBreak routine.','Setting: 19 participants completed short laboratory sessions, not months of normal desk work.','Outcome: the researchers measured post-drink glucose and insulin, not long-term health outcomes.','Testing a 20-minute interval does not establish it as the best interval for everyone.'],dimensions:{desktop:[1200,850],mobile:[600,1200]},
    draw(m){const p=m?36:56;let b='';const rows=[['The activity','Walking breaks','Not a stretching routine'],['The setting','Short laboratory sessions','Not months of desk work'],['The outcome','Post-drink blood markers','Not long-term health']];
      if(!m){b+=text('What was tested',p+250,240,28,C.blue,800)+text('What it cannot establish',p+630,240,28,C.muted,800);}
      rows.forEach(([label,left,right],i)=>{const y=(m?282:280)+i*(m?226:140);b+=line(p,y+(m?204:119),m?564:1144,y+(m?204:119));
        if(m){b+=pill(label,p,y,C.yellow,C.ink,25)+text(left,p,y+98,29,C.blue,800)+text(right,p,y+153,27,C.muted);}
        else{b+=text(label,p,y+56,30,C.ink,800)+para(left,p+250,y+40,310,30,C.blue,800)+para(right,p+630,y+40,390,30,C.muted);}
      });
      const by=m?1020:730;b+=rect(p,by-43,m?528:1088,m?84:62,C.yellow,12)+para('An experiment is not a universal schedule.',p+20,by,m?486:1048,m?28:30,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'eye-break-mnemonic',title:'The 20-20-20 reminder',label:'A familiar mnemonic',sourceLine:'Talens-Estarelles et al. (2023)',
    postSlug:'does-the-20-20-20-rule-work',placement:{afterHeading:null,afterParagraphStartsWith:'The 20-20-20 rule is simple:'},sourceIds:[sources.eyes.id],
    alt:'The mnemonic means every 20 minutes, look about 20 feet away, for 20 seconds. Twenty feet is about six metres.',
    caption:'These numbers describe the mnemonic used in the study. They are not established as the optimal timing or distance.',
    longDescription:['Every 20 minutes: a prompt to interrupt sustained near-screen viewing.','About 20 feet away: approximately six metres.','For 20 seconds: the duration in this commonly used reminder.','The cited study evaluated the rule as a package; it did not compare different intervals, distances or durations.'],dimensions:{desktop:[1200,830],mobile:[600,1190]},
    draw(m){const p=m?36:56;let b=para('A prompt to look beyond the screen.',p,m?256:217,m?528:1088,m?29:31,C.muted);
      const steps=[['clock','Every','minutes'],['window','Look about','feet away'],['timer','For','seconds']];
      steps.forEach(([ic,lead,unit],i)=>{const x=m?p:p+i*371,y=m?315+i*220:265,cw=m?528:344,ch=m?197:338;b+=rect(x,y,cw,ch,i===1?C.soft:C.white,18);
        if(m){b+=icon(ic,x+23,y+43,104)+text(lead,x+161,y+45,27,C.muted)+text('20',x+155,y+131,100,C.blue,800)+text(unit,x+298,y+130,28,C.ink,800);if(i===1)b+=text('about 6 metres',x+163,y+172,25,C.muted);}
        else{b+=icon(ic,x+229,y+24,80)+text(lead,x+26,y+54,27,C.muted)+text('20',x+23,y+205,148,C.blue,800)+text(unit,x+28,y+270,34,C.ink,800);if(i===1)b+=text('about 6 metres',x+28,y+308,25,C.muted);}
      });
      b+=para('The study did not compare alternative schedules.',p,m?1042:692,m?528:1030,m?28:31,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'eye-break-study',title:'What one small study tested',label:'Study design',sourceLine:'Talens-Estarelles et al. (2023)',
    postSlug:'does-the-20-20-20-rule-work',placement:{afterHeading:'The study',afterParagraphStartsWith:'Researchers recruited 29 computer users'},sourceIds:[sources.eyes.id],
    alt:'Twenty-nine symptomatic computer users were monitored for two weeks without reminders, two weeks with reminders, and one week after reminders stopped.',
    caption:'A before-and-after comparison in the same people, with no separate control group. Symptom questionnaires and clinical eye measurements are different outcomes.',
    longDescription:['The study recruited 29 computer users with symptoms of digital eye strain.','The full timeline comprised two weeks of baseline monitoring without reminders, two weeks with 20-20-20 software reminders, and one week after the reminders stopped.','Participants reported fewer symptoms during reminders; improvements were not clearly sustained after reminders stopped.','Dry-eye signs did not improve over two weeks. Most binocular vision measures did not change, although accommodative facility improved.','This small study had no separate control group and did not compare alternative break schedules.'],dimensions:{desktop:[1200,950],mobile:[600,1360]},
    draw(m){const p=m?36:56;let b=pill('29 symptomatic computer users',p,m?286:208,C.yellow,C.ink,m?24:28);
      const periods=[['2 weeks','Baseline monitoring','No reminders',C.line],['2 weeks','20-20-20 reminders','Software prompts',C.blue],['1 week','After reminders stopped','Follow-up',C.ink]];
      periods.forEach(([dur,title,sub,color],i)=>{const x=m?p:p+i*371,y=m?372+i*184:302,cw=m?528:344,ch=m?158:271;b+=rect(x,y,cw,ch,C.white,16)+rect(x,y,cw,9,color,3);
        if(m){b+=text(dur,x+24,y+47,35,color===C.line?C.ink:color,800)+text(title,x+24,y+94,28,C.ink,800)+text(sub,x+24,y+134,25,C.muted);}
        else{b+=text(dur,x+24,y+73,49,color===C.line?C.ink:color,800)+para(title,x+24,y+138,296,30,C.ink,800)+text(sub,x+24,y+237,26,C.muted);}
      });
      const y=m?984:653;b+=para('Reported symptoms improved during reminders.',p,y,m?528:1030,m?29:32,C.blue,800)+para('Improvement was not clearly sustained after stopping.',p,y+(m?102:66),m?528:1030,m?28:31,C.ink);
      b+=para('Same people before and after. No separate control group.',p,m?1178:826,m?528:1050,m?25:28,C.muted);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'standing-desk-trial',title:'A desk was part of a programme',label:'Study design',sourceLine:'Edwardson et al. (2022), BMJ',
    postSlug:'are-standing-desks-worth-it',placement:{afterHeading:'A bigger trial, a year long',afterParagraphStartsWith:'A 2022 trial published in the BMJ gave firmer numbers'},sourceIds:[sources.desk.id],
    alt:'A trial randomized 78 workplace clusters with 756 UK employees to usual practice, a sit-less programme, or the same programme plus a height-adjustable desk.',
    caption:'The trial compared three groups over 12 months. There was no desk-only group, so the combined result cannot be attributed to buying a desk alone.',
    longDescription:['The trial enrolled 756 desk-based local-government employees in 78 workplace clusters in the United Kingdom.','Clusters were randomized to usual practice, the SMART Work and Life (SWAL) sit-less programme, or SWAL plus a height-adjustable desk.','The primary comparison was daily sitting time at 12 months. This included time during and outside work.','There was no group given only a desk without the programme.'],dimensions:{desktop:[1200,920],mobile:[600,1270]},
    draw(m){const p=m?36:56;let b=para('756 UK employees. 78 workplace clusters.',p,m?279:230,m?528:1088,m?28:31,C.muted);
      const arms=[['people','Usual practice','Control group'],['programme','Sit-less programme','SMART Work and Life'],['desk','Programme + desk','Same support, plus an adjustable desk']];
      arms.forEach(([ic,title,sub],i)=>{const x=m?p:p+i*371,y=m?357+i*216:290,cw=m?528:344,ch=m?190:335;b+=rect(x,y,cw,ch,i===2?C.soft:C.white,18);
        if(m){b+=icon(ic,x+22,y+50,94)+para(title,x+139,y+55,359,32,C.ink,800)+para(sub,x+139,y+124,353,26,C.muted);}
        else{b+=icon(ic,x+24,y+22,102)+para(title,x+24,y+181,296,34,C.ink,800)+para(sub,x+24,y+268,296,27,C.muted);}
      });
      b+=pill('Compared at 12 months',p,m?1040:688,C.yellow,C.ink,m?27:30)+para('There was no desk-only group.',p,m?1147:798,m?528:1088,m?30:35,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
  {
    id:'standing-desk-results',title:'Daily sitting at 12 months',label:'Trial results',sourceLine:'Edwardson et al. (2022), BMJ, Table 2',
    postSlug:'are-standing-desks-worth-it',placement:{afterHeading:'A bigger trial, a year long',afterParagraphStartsWith:'At twelve months, the group with the desk'},sourceIds:[sources.desk.id],
    alt:'Compared with usual practice, adjusted daily sitting was 22.2 minutes lower with the programme and 63.7 minutes lower with the programme plus a desk.',
    caption:'Adjusted between-group differences in total daily sitting at 12 months, shown as minutes less than usual practice. Whiskers represent 95% confidence intervals.',
    longDescription:['The programme-alone estimate was 22.2 fewer minutes per day than usual practice, with a 95% confidence interval from 5.7 to 38.8 fewer minutes.','The programme-plus-desk estimate was 63.7 fewer minutes per day, with a 95% confidence interval from 47.4 to 80.1 fewer minutes.','These are adjusted between-group differences, not raw before-and-after changes. The measure included sitting during and outside working hours.','The trial had no desk-only group. These estimates do not establish a long-term health benefit or a result for DeskBreak.'],
    dataTable:{caption:'Adjusted daily sitting differences versus usual practice at 12 months',columns:['Group','Difference (min/day)','95% CI lower','95% CI upper'],rows:sittingDifferences.map((d,i)=>[i?'SWAL programme + desk':'SWAL programme',d.estimate,d.ci95Lower,d.ci95Upper]),note:'Negative values mean less total daily sitting than usual practice. Published adjusted between-group estimates from Table 2; daily sitting includes work and non-work time.'},
    dimensions:{desktop:[1200,950],mobile:[600,1110]},
    draw(m){const p=m?36:56;let b=para('Minutes less per day than usual practice',p,m?275:224,m?528:1088,m?29:32,C.muted);
      const x0=m?60:384,x1=m?548:1112,top=m?480:344,bottom=m?766:628,scale=v=>x0+v/90*(x1-x0);
      for(const tick of [0,15,30,45,60,75,90])b+=line(scale(tick),top-35,scale(tick),bottom+30,tick===0?C.muted:C.line,tick===0?3:2)+text(String(tick),scale(tick),bottom+73,m?25:26,C.muted,500,'center');
      const groups=sittingDifferences.map((d,i)=>[i?'Programme + desk':'Programme',-d.estimate,-d.ci95Upper,-d.ci95Lower,i?C.blue:C.ink]);
      groups.forEach(([label,val,lo,hi,color],i)=>{const y=m?493+i*250:382+i*205;
        if(m)b+=text(label,p,y-76,30,color,800)+text(`${val} min`,564,y-76,30,color,800,'right');
        else b+=para(label,p,y-36,280,33,color,800)+text(`${val} min less`,p,y+70,30,color,800);
        b+=line(scale(lo),y,scale(hi),y,color,8)+line(scale(lo),y-16,scale(lo),y+16,color,4)+line(scale(hi),y-16,scale(hi),y+16,color,4)+circle(scale(val),y,14,color)+circle(scale(val),y,5,C.white);
        b+=text(`95% CI ${lo} to ${hi}`,m?p:scale(lo),y+62,m?27:26,C.muted);
      });
      const y=m?924:791;b+=text('Whiskers show 95% confidence intervals.',p,y,m?26:28,C.muted)+para('Daily sitting includes time at work and outside work.',p,y+53,m?528:1088,m?28:30,C.ink,800);return shell(this,m,this.dimensions[m?'mobile':'desktop'][1],b);},
  },
];

for(const dir of ['svg','webp','preview','source/editable'])await fs.mkdir(path.join(root,dir),{recursive:true});
const manifest={version:'1.0.0',createdAt:'2026-09-25',publicBasePath:'/blog/figures/v1',assets:[]};
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
const articles=manifest.assets.map(a=>`<article id="${a.id}"><h2>${esc(a.title)}</h2><p>For <a href="https://deskbreak.co/blog/${a.postSlug}">${esc(a.postSlug.replaceAll('-',' '))}</a></p><figure><picture><source media="(max-width:640px)" srcset="${a.files.mobile.webp}" width="${a.files.mobile.width}" height="${a.files.mobile.height}"><img src="${a.files.desktop.webp}" width="${a.files.desktop.width}" height="${a.files.desktop.height}" alt="${esc(a.alt)}" loading="lazy"></picture><figcaption>${esc(a.caption)}</figcaption></figure><nav aria-label="${esc(a.title)} files"><a href="${a.files.desktop.svg}">Desktop SVG</a><a href="${a.files.mobile.svg}">Mobile SVG</a><a href="source/editable/${a.id}--desktop.svg">Editable master</a></nav><details><summary>Text description and source</summary>${a.longDescription.map(p=>`<p>${esc(p)}</p>`).join('')}${tableMarkup(a)}<p>${a.sourceIds.map(id=>{const s=Object.values(sources).find(v=>v.id===id);return `<a href="${s.url}">${s.label}</a>`;}).join(', ')}</p></details></article>`).join('');
await fs.writeFile(path.join(root,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeskBreak research figures</title><style>${galleryStyle}</style></head><body><header><p>DeskBreak editorial assets / Version 1</p><h1>Research, made easier to understand.</h1><p>Six original figures for three pilot articles. Resize this preview to see the separate mobile layouts. These are sourced research explanations, not clinical approval or claims about DeskBreak outcomes.</p><nav><a href="README.md">Developer handoff</a><a href="asset-manifest.json">Asset manifest</a><a href="SOURCES.md">Source checks</a></nav></header><main>${articles}</main></body></html>`);

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
