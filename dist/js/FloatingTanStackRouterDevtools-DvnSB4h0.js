import{n as e,o as t,p as i,q as r,S as n,s as o,t as l,v as a,w as s,x as d,y as c,z as f,A as u,B as p,C as g,D as h,E as v,F as x,G as m,H as b,I as $,J as y}from"./unknown-BjZws6l5.js";import{c as k}from"./unknown-CWUl0966.js";import"./unknown-DE60C25c.js";const w="undefined"==typeof window;function C(e){return e.isFetching&&"success"===e.status?"beforeLoad"===e.isFetching?"purple":"blue":{pending:"yellow",success:"green",error:"red",notFound:"purple",redirected:"gray"}[e.status]}function S(e){return e.replace(/\/{2,}/g,"/")}function F(e){return function(e){return"/"===e?e:e.replace(/\/{1,}$/,"")}(function(e){return"/"===e?e:e.replace(/^\/{1,}/,"")}(e))}function z({path:e,params:t,leaveWildcards:i,leaveParams:r,decodeCharMap:n}){const o=function(e){if(!e)return[];const t=[];if("/"===(e=S(e)).slice(0,1)&&(e=e.substring(1),t.push({type:"pathname",value:"/"})),!e)return t;const i=e.split("/").filter(Boolean);return t.push(...i.map((e=>"$"===e||"*"===e?{type:"wildcard",value:e}:"$"===e.charAt(0)?{type:"param",value:e}:{type:"pathname",value:e.includes("%25")?e.split("%25").map((e=>decodeURI(e))).join("%25"):decodeURI(e)}))),"/"===e.slice(-1)&&(e=e.substring(1),t.push({type:"pathname",value:"/"})),t}(e);function l(e){const i=t[e],r="string"==typeof i;return["*","_splat"].includes(e)?r?encodeURI(i):i:r?function(e,t){let i=encodeURIComponent(e);if(t)for(const[r,n]of t)i=i.replaceAll(r,n);return i}(i,n):i}let a=!1;const s={},d=S(o.map((e=>{if("wildcard"===e.type)return s._splat=t._splat,l("_splat");if("param"===e.type){const i=e.value.substring(1);return a||i in t||(a=!0),s[i]=t[i],l(i)??"undefined"}return e.value})).filter((e=>void 0!==e)).join("/"));return{usedParams:s,interpolatedPath:d,isMissingParams:a}}const U="__root__";let M={data:""},B=e=>"object"==typeof window?((e?e.querySelector("#_goober"):window._goober)||Object.assign((e||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:e||M,E=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,O=/\/\*[^]*?\*\/|  +/g,D=/\n+/g,I=(e,t)=>{let i="",r="",n="";for(let o in e){let l=e[o];"@"==o[0]?"i"==o[1]?i=o+" "+l+";":r+="f"==o[1]?I(l,o):o+"{"+I(l,"k"==o[1]?"":t)+"}":"object"==typeof l?r+=I(l,t?t.replace(/([^,])+/g,(e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,(t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)))):o):null!=l&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),n+=I.p?I.p(o,l):o+":"+l+";")}return i+(t&&n?t+"{"+n+"}":n)+r},G={},A=e=>{if("object"==typeof e){let t="";for(let i in e)t+=i+A(e[i]);return t}return e},T=(e,t,i,r,n)=>{let o=A(e),l=G[o]||(G[o]=(e=>{let t=0,i=11;for(;t<e.length;)i=101*i+e.charCodeAt(t++)>>>0;return"go"+i})(o));if(!G[l]){let t=o!==e?e:(e=>{let t,i,r=[{}];for(;t=E.exec(e.replace(O,""));)t[4]?r.shift():t[3]?(i=t[3].replace(D," ").trim(),r.unshift(r[0][i]=r[0][i]||{})):r[0][t[1]]=t[2].replace(D," ").trim();return r[0]})(e);G[l]=I(n?{["@keyframes "+l]:t}:t,i?"":"."+l)}let a=i&&G.g?G.g:null;return i&&(G.g=G[l]),((e,t,i,r)=>{r?t.data=t.data.replace(r,e):-1===t.data.indexOf(e)&&(t.data=i?e+t.data:t.data+e)})(G[l],t,r,a),l};function j(e){let t=this||{},i=e.call?e(t.p):e;return T(i.unshift?i.raw?((e,t,i)=>e.reduce(((e,r,n)=>{let o=t[n];if(o&&o.call){let e=o(i),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":I(e,""):!1===e?"":e}return e+r+(null==o?"":o)}),""))(i,[].slice.call(arguments,1),t.p):i.reduce(((e,i)=>Object.assign(e,i&&i.call?i(t.p):i)),{}):i,B(t.target),t.g,t.o,t.k)}j.bind({g:1}),j.bind({k:1});const P={colors:{inherit:"inherit",current:"currentColor",transparent:"transparent",black:"#000000",white:"#ffffff",neutral:{50:"#f9fafb",100:"#f2f4f7",200:"#eaecf0",300:"#d0d5dd",400:"#98a2b3",500:"#667085",600:"#475467",700:"#344054",800:"#1d2939",900:"#101828"},darkGray:{50:"#525c7a",100:"#49536e",200:"#414962",300:"#394056",400:"#313749",500:"#292e3d",600:"#212530",700:"#191c24",800:"#111318",900:"#0b0d10"},gray:{50:"#f9fafb",100:"#f2f4f7",200:"#eaecf0",300:"#d0d5dd",400:"#98a2b3",500:"#667085",600:"#475467",700:"#344054",800:"#1d2939",900:"#101828"},blue:{25:"#F5FAFF",50:"#EFF8FF",100:"#D1E9FF",200:"#B2DDFF",300:"#84CAFF",400:"#53B1FD",500:"#2E90FA",600:"#1570EF",700:"#175CD3",800:"#1849A9",900:"#194185"},green:{25:"#F6FEF9",50:"#ECFDF3",100:"#D1FADF",200:"#A6F4C5",300:"#6CE9A6",400:"#32D583",500:"#12B76A",600:"#039855",700:"#027A48",800:"#05603A",900:"#054F31"},red:{50:"#fef2f2",100:"#fee2e2",200:"#fecaca",300:"#fca5a5",400:"#f87171",500:"#ef4444",600:"#dc2626",700:"#b91c1c",800:"#991b1b",900:"#7f1d1d",950:"#450a0a"},yellow:{25:"#FFFCF5",50:"#FFFAEB",100:"#FEF0C7",200:"#FEDF89",300:"#FEC84B",400:"#FDB022",500:"#F79009",600:"#DC6803",700:"#B54708",800:"#93370D",900:"#7A2E0E"},purple:{25:"#FAFAFF",50:"#F4F3FF",100:"#EBE9FE",200:"#D9D6FE",300:"#BDB4FE",400:"#9B8AFB",500:"#7A5AF8",600:"#6938EF",700:"#5925DC",800:"#4A1FB8",900:"#3E1C96"},teal:{25:"#F6FEFC",50:"#F0FDF9",100:"#CCFBEF",200:"#99F6E0",300:"#5FE9D0",400:"#2ED3B7",500:"#15B79E",600:"#0E9384",700:"#107569",800:"#125D56",900:"#134E48"},pink:{25:"#fdf2f8",50:"#fce7f3",100:"#fbcfe8",200:"#f9a8d4",300:"#f472b6",400:"#ec4899",500:"#db2777",600:"#be185d",700:"#9d174d",800:"#831843",900:"#500724"},cyan:{25:"#ecfeff",50:"#cffafe",100:"#a5f3fc",200:"#67e8f9",300:"#22d3ee",400:"#06b6d4",500:"#0891b2",600:"#0e7490",700:"#155e75",800:"#164e63",900:"#083344"}},alpha:{90:"e5",70:"b3",20:"33"},font:{size:{"2xs":"calc(var(--tsrd-font-size) * 0.625)",xs:"calc(var(--tsrd-font-size) * 0.75)",sm:"calc(var(--tsrd-font-size) * 0.875)",md:"var(--tsrd-font-size)"},lineHeight:{xs:"calc(var(--tsrd-font-size) * 1)",sm:"calc(var(--tsrd-font-size) * 1.25)"},weight:{normal:"400",medium:"500",semibold:"600",bold:"700"},fontFamily:{sans:"ui-sans-serif, Inter, system-ui, sans-serif, sans-serif",mono:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"}},border:{radius:{xs:"calc(var(--tsrd-font-size) * 0.125)",sm:"calc(var(--tsrd-font-size) * 0.25)",md:"calc(var(--tsrd-font-size) * 0.375)",full:"9999px"}},size:{0:"0px",.5:"calc(var(--tsrd-font-size) * 0.125)",1:"calc(var(--tsrd-font-size) * 0.25)",1.5:"calc(var(--tsrd-font-size) * 0.375)",2:"calc(var(--tsrd-font-size) * 0.5)",2.5:"calc(var(--tsrd-font-size) * 0.625)",3:"calc(var(--tsrd-font-size) * 0.75)",3.5:"calc(var(--tsrd-font-size) * 0.875)",4:"calc(var(--tsrd-font-size) * 1)",5:"calc(var(--tsrd-font-size) * 1.25)",8:"calc(var(--tsrd-font-size) * 2)"}};function L(){const t=r(n),[i]=e((e=>{const{colors:t,font:i,size:r,alpha:n,border:o}=P,{fontFamily:l,lineHeight:a,size:s}=i,d=e?j.bind({target:e}):j;return{devtoolsPanelContainer:d`
      direction: ltr;
      position: fixed;
      bottom: 0;
      right: 0;
      z-index: 99999;
      width: 100%;
      max-height: 90%;
      border-top: 1px solid ${t.gray[700]};
      transform-origin: top;
    `,devtoolsPanelContainerVisibility:e=>d`
        visibility: ${e?"visible":"hidden"};
      `,devtoolsPanelContainerResizing:e=>e()?d`
          transition: none;
        `:d`
        transition: all 0.4s ease;
      `,devtoolsPanelContainerAnimation:(e,t)=>e?d`
          pointer-events: auto;
          transform: translateY(0);
        `:d`
        pointer-events: none;
        transform: translateY(${t}px);
      `,logo:d`
      cursor: pointer;
      display: flex;
      flex-direction: column;
      background-color: transparent;
      border: none;
      font-family: ${l.sans};
      gap: ${P.size[.5]};
      padding: 0px;
      &:hover {
        opacity: 0.7;
      }
      &:focus-visible {
        outline-offset: 4px;
        border-radius: ${o.radius.xs};
        outline: 2px solid ${t.blue[800]};
      }
    `,tanstackLogo:d`
      font-size: ${i.size.md};
      font-weight: ${i.weight.bold};
      line-height: ${i.lineHeight.xs};
      white-space: nowrap;
      color: ${t.gray[300]};
    `,routerLogo:d`
      font-weight: ${i.weight.semibold};
      font-size: ${i.size.xs};
      background: linear-gradient(to right, #84cc16, #10b981);
      background-clip: text;
      -webkit-background-clip: text;
      line-height: 1;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    `,devtoolsPanel:d`
      display: flex;
      font-size: ${s.sm};
      font-family: ${l.sans};
      background-color: ${t.darkGray[700]};
      color: ${t.gray[300]};

      @media (max-width: 700px) {
        flex-direction: column;
      }
      @media (max-width: 600px) {
        font-size: ${s.xs};
      }
    `,dragHandle:d`
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 4px;
      cursor: row-resize;
      z-index: 100000;
      &:hover {
        background-color: ${t.purple[400]}${n[90]};
      }
    `,firstContainer:d`
      flex: 1 1 500px;
      min-height: 40%;
      max-height: 100%;
      overflow: auto;
      border-right: 1px solid ${t.gray[700]};
      display: flex;
      flex-direction: column;
    `,routerExplorerContainer:d`
      overflow-y: auto;
      flex: 1;
    `,routerExplorer:d`
      padding: ${P.size[2]};
    `,row:d`
      display: flex;
      align-items: center;
      padding: ${P.size[2]} ${P.size[2.5]};
      gap: ${P.size[2.5]};
      border-bottom: ${t.darkGray[500]} 1px solid;
      align-items: center;
    `,detailsHeader:d`
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: ${t.darkGray[600]};
      padding: 0px ${P.size[2]};
      font-weight: ${i.weight.medium};
      font-size: ${i.size.xs};
      min-height: ${P.size[8]};
      line-height: ${i.lineHeight.xs};
      text-align: left;
      display: flex;
      align-items: center;
    `,maskedBadge:d`
      background: ${t.yellow[900]}${n[70]};
      color: ${t.yellow[300]};
      display: inline-block;
      padding: ${P.size[0]} ${P.size[2.5]};
      border-radius: ${o.radius.full};
      font-size: ${i.size.xs};
      font-weight: ${i.weight.normal};
      border: 1px solid ${t.yellow[300]};
    `,maskedLocation:d`
      color: ${t.yellow[300]};
    `,detailsContent:d`
      padding: ${P.size[1.5]} ${P.size[2]};
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: ${i.size.xs};
    `,routeMatchesToggle:d`
      display: flex;
      align-items: center;
      border: 1px solid ${t.gray[500]};
      border-radius: ${o.radius.sm};
      overflow: hidden;
    `,routeMatchesToggleBtn:(e,r)=>{const o=[d`
        appearance: none;
        border: none;
        font-size: 12px;
        padding: 4px 8px;
        background: transparent;
        cursor: pointer;
        font-family: ${l.sans};
        font-weight: ${i.weight.medium};
      `];if(e){const e=d`
          background: ${t.darkGray[400]};
          color: ${t.gray[300]};
        `;o.push(e)}else{const e=d`
          color: ${t.gray[500]};
          background: ${t.darkGray[800]}${n[20]};
        `;o.push(e)}return r&&o.push(d`
          border-right: 1px solid ${P.colors.gray[500]};
        `),o},detailsHeaderInfo:d`
      flex: 1;
      justify-content: flex-end;
      display: flex;
      align-items: center;
      font-weight: ${i.weight.normal};
      color: ${t.gray[400]};
    `,matchRow:e=>{const i=[d`
        display: flex;
        border-bottom: 1px solid ${t.darkGray[400]};
        cursor: pointer;
        align-items: center;
        padding: ${r[1]} ${r[2]};
        gap: ${r[2]};
        font-size: ${s.xs};
        color: ${t.gray[300]};
      `];if(e){const e=d`
          background: ${t.darkGray[500]};
        `;i.push(e)}return i},matchIndicator:e=>{const i=[d`
        flex: 0 0 auto;
        width: ${r[3]};
        height: ${r[3]};
        background: ${t[e][900]};
        border: 1px solid ${t[e][500]};
        border-radius: ${o.radius.full};
        transition: all 0.25s ease-out;
        box-sizing: border-box;
      `];if("gray"===e){const e=d`
          background: ${t.gray[700]};
          border-color: ${t.gray[400]};
        `;i.push(e)}return i},matchID:d`
      flex: 1;
      line-height: ${a.xs};
    `,ageTicker:e=>{const i=[d`
        display: flex;
        gap: ${r[1]};
        font-size: ${s.xs};
        color: ${t.gray[400]};
        font-variant-numeric: tabular-nums;
        line-height: ${a.xs};
      `];if(e){const e=d`
          color: ${t.yellow[400]};
        `;i.push(e)}return i},secondContainer:d`
      flex: 1 1 500px;
      min-height: 40%;
      max-height: 100%;
      overflow: auto;
      border-right: 1px solid ${t.gray[700]};
      display: flex;
      flex-direction: column;
    `,thirdContainer:d`
      flex: 1 1 500px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      height: 100%;
      border-right: 1px solid ${t.gray[700]};

      @media (max-width: 700px) {
        border-top: 2px solid ${t.gray[700]};
      }
    `,fourthContainer:d`
      flex: 1 1 500px;
      min-height: 40%;
      max-height: 100%;
      overflow: auto;
      display: flex;
      flex-direction: column;
    `,routesContainer:d`
      overflow-x: auto;
      overflow-y: visible;
    `,routesRowContainer:(e,i)=>{const n=[d`
        display: flex;
        border-bottom: 1px solid ${t.darkGray[400]};
        align-items: center;
        padding: ${r[1]} ${r[2]};
        gap: ${r[2]};
        font-size: ${s.xs};
        color: ${t.gray[300]};
        cursor: ${i?"pointer":"default"};
        line-height: ${a.xs};
      `];if(e){const e=d`
          background: ${t.darkGray[500]};
        `;n.push(e)}return n},routesRow:e=>{const i=[d`
        flex: 1 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: ${s.xs};
        line-height: ${a.xs};
      `];if(!e){const e=d`
          color: ${t.gray[400]};
        `;i.push(e)}return i},routesRowInner:d`
      display: 'flex';
      align-items: 'center';
      flex-grow: 1;
      min-width: 0;
    `,routeParamInfo:d`
      color: ${t.gray[400]};
      font-size: ${s.xs};
      line-height: ${a.xs};
    `,nestedRouteRow:e=>d`
        margin-left: ${e?0:r[3.5]};
        border-left: ${e?"":`solid 1px ${t.gray[700]}`};
      `,code:d`
      font-size: ${s.xs};
      line-height: ${a.xs};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,matchesContainer:d`
      flex: 1 1 auto;
      overflow-y: auto;
    `,cachedMatchesContainer:d`
      flex: 1 1 auto;
      overflow-y: auto;
      max-height: 50%;
    `,maskedBadgeContainer:d`
      flex: 1;
      justify-content: flex-end;
      display: flex;
    `,matchDetails:d`
      display: flex;
      flex-direction: column;
      padding: ${P.size[2]};
      font-size: ${P.font.size.xs};
      color: ${P.colors.gray[300]};
      line-height: ${P.font.lineHeight.sm};
    `,matchStatus:(e,t)=>{const i=t&&"success"===e?"beforeLoad"===t?"purple":"blue":{pending:"yellow",success:"green",error:"red",notFound:"purple",redirected:"gray"}[e];return d`
        display: flex;
        justify-content: center;
        align-items: center;
        height: 40px;
        border-radius: ${P.border.radius.sm};
        font-weight: ${P.font.weight.normal};
        background-color: ${P.colors[i][900]}${P.alpha[90]};
        color: ${P.colors[i][300]};
        border: 1px solid ${P.colors[i][600]};
        margin-bottom: ${P.size[2]};
        transition: all 0.25s ease-out;
      `},matchDetailsInfo:d`
      display: flex;
      justify-content: flex-end;
      flex: 1;
    `,matchDetailsInfoLabel:d`
      display: flex;
    `,mainCloseBtn:d`
      background: ${t.darkGray[700]};
      padding: ${r[1]} ${r[2]} ${r[1]} ${r[1.5]};
      border-radius: ${o.radius.md};
      position: fixed;
      z-index: 99999;
      display: inline-flex;
      width: fit-content;
      cursor: pointer;
      appearance: none;
      border: 0;
      gap: 8px;
      align-items: center;
      border: 1px solid ${t.gray[500]};
      font-size: ${i.size.xs};
      cursor: pointer;
      transition: all 0.25s ease-out;

      &:hover {
        background: ${t.darkGray[500]};
      }
    `,mainCloseBtnPosition:e=>d`
        ${"top-left"===e?`top: ${r[2]}; left: ${r[2]};`:""}
        ${"top-right"===e?`top: ${r[2]}; right: ${r[2]};`:""}
        ${"bottom-left"===e?`bottom: ${r[2]}; left: ${r[2]};`:""}
        ${"bottom-right"===e?`bottom: ${r[2]}; right: ${r[2]};`:""}
      `,mainCloseBtnAnimation:e=>e?d`
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      `:d`
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
        `,routerLogoCloseButton:d`
      font-weight: ${i.weight.semibold};
      font-size: ${i.size.xs};
      background: linear-gradient(to right, #98f30c, #00f4a3);
      background-clip: text;
      -webkit-background-clip: text;
      line-height: 1;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    `,mainCloseBtnDivider:d`
      width: 1px;
      background: ${P.colors.gray[600]};
      height: 100%;
      border-radius: 999999px;
      color: transparent;
    `,mainCloseBtnIconContainer:d`
      position: relative;
      width: ${r[5]};
      height: ${r[5]};
      background: pink;
      border-radius: 999999px;
      overflow: hidden;
    `,mainCloseBtnIconOuter:d`
      width: ${r[5]};
      height: ${r[5]};
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      filter: blur(3px) saturate(1.8) contrast(2);
    `,mainCloseBtnIconInner:d`
      width: ${r[4]};
      height: ${r[4]};
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `,panelCloseBtn:d`
      position: absolute;
      cursor: pointer;
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      background-color: ${t.darkGray[700]};
      &:hover {
        background-color: ${t.darkGray[500]};
      }

      top: 0;
      right: ${r[2]};
      transform: translate(0, -100%);
      border-right: ${t.darkGray[300]} 1px solid;
      border-left: ${t.darkGray[300]} 1px solid;
      border-top: ${t.darkGray[300]} 1px solid;
      border-bottom: none;
      border-radius: ${o.radius.sm} ${o.radius.sm} 0px 0px;
      padding: ${r[1]} ${r[1.5]} ${r[.5]} ${r[1.5]};

      &::after {
        content: ' ';
        position: absolute;
        top: 100%;
        left: -${r[2.5]};
        height: ${r[1.5]};
        width: calc(100% + ${r[5]});
      }
    `,panelCloseBtnIcon:d`
      color: ${t.gray[400]};
      width: ${r[2]};
      height: ${r[2]};
    `,navigateButton:d`
      background: none;
      border: none;
      padding: 0 0 0 4px;
      margin: 0;
      color: ${t.gray[400]};
      font-size: ${s.md};
      cursor: pointer;
      line-height: 1;
      vertical-align: middle;
      margin-right: 0.5ch;
      flex-shrink: 0;
      &:hover {
        color: ${t.blue[300]};
      }
    `}})(t));return i}function R(i,r){const[n,o]=e();t((()=>{const e=(e=>{try{const t=localStorage.getItem(e);return"string"==typeof t?JSON.parse(t):void 0}catch{return}})(i);o(null==e?"function"==typeof r?r():r:e)}));return[n,e=>{o((t=>{let r=e;"function"==typeof e&&(r=e(t));try{localStorage.setItem(i,JSON.stringify(r))}catch{}return r}))}]}var H=l('<span><svg xmlns=http://www.w3.org/2000/svg width=12 height=12 fill=none viewBox="0 0 24 24"><path stroke=currentColor stroke-linecap=round stroke-linejoin=round stroke-width=2 d="M9 18l6-6-6-6">'),N=l("<div>"),_=l("<button><span> "),J=l("<div><div><button> [<!> ... <!>]"),q=l("<button><span></span> 🔄 "),K=l("<span>:"),V=l("<span>");const Y=({expanded:e,style:t={}})=>{const r=Q();return n=H(),o=n.firstChild,i((t=>{var i=r().expander,l=k(r().expanderIcon(e));return i!==t.e&&c(n,t.e=i),l!==t.t&&f(o,"class",t.t=l),t}),{e:void 0,t:void 0}),n;var n,o};function W({value:t,defaultExpanded:r,pageSize:n=100,filterSubEntries:l,...f}){const[u,g]=e(Boolean(r)),h=o((()=>typeof t())),v=o((()=>{let e=[];const i=e=>{const t=!0===r?{[e.label]:!0}:null==r?void 0:r[e.label];return{...e,value:()=>e.value,defaultExpanded:t}};var n;return Array.isArray(t())?e=t().map(((e,t)=>i({label:t.toString(),value:e}))):null!==t()&&"object"==typeof t()&&(n=t(),Symbol.iterator in n)&&"function"==typeof t()[Symbol.iterator]?e=Array.from(t(),((e,t)=>i({label:t.toString(),value:e}))):"object"==typeof t()&&null!==t()&&(e=Object.entries(t()).map((([e,t])=>i({label:e,value:t})))),l?l(e):e})),x=o((()=>function(e,t){if(t<1)return[];let i=0;const r=[];for(;i<e.length;)r.push(e.slice(i,i+t)),i+=t;return r}(v(),n))),[m,b]=e([]),[$,y]=e(void 0),w=Q(),C=()=>{y(t()())},S=e=>d(W,p({value:t,filterSubEntries:l},f,e));return z=N(),a(z,(F=s((()=>!!x().length)),()=>{return F()?[(r=_(),o=r.firstChild,l=o.firstChild,r.$$click=()=>g((e=>!e)),a(r,d(Y,{get expanded(){return u()??!1}}),o),a(r,(()=>f.label),o),a(o,(()=>"iterable"===String(h).toLowerCase()?"(Iterable) ":""),l),a(o,(()=>v().length),l),a(o,(()=>v().length>1?"items":"item"),null),i((e=>{var t=w().expandButton,i=w().info;return t!==e.e&&c(r,e.e=t),i!==e.t&&c(o,e.t=i),e}),{e:void 0,t:void 0}),r),s((()=>{return s((()=>!!u()))()?s((()=>1===x().length))()?(t=N(),a(t,(()=>v().map(((e,t)=>S(e))))),i((()=>c(t,w().subEntries))),t):(e=N(),a(e,(()=>x().map(((e,t)=>{return o=J(),l=o.firstChild,f=l.firstChild,u=f.firstChild,p=u.nextSibling,(g=p.nextSibling.nextSibling).nextSibling,f.$$click=()=>b((e=>e.includes(t)?e.filter((e=>e!==t)):[...e,t])),a(f,d(Y,{get expanded(){return m().includes(t)}}),u),a(f,t*n,p),a(f,t*n+n-1,g),a(l,(r=s((()=>!!m().includes(t))),()=>{return r()?(t=N(),a(t,(()=>e.map((e=>S(e))))),i((()=>c(t,w().subEntries))),t):null;var t}),null),i((e=>{var t=w().entry,i=k(w().labelButton,"labelButton");return t!==e.e&&c(l,e.e=t),i!==e.t&&c(f,e.t=i),e}),{e:void 0,t:void 0}),o;var r,o,l,f,u,p,g})))),i((()=>c(e,w().subEntries))),e):null;var e,t}))]:(e=s((()=>"function"===h())),()=>{return e()?d(W,{get label(){return e=q(),t=e.firstChild,e.$$click=C,a(t,(()=>f.label)),i((()=>c(e,w().refreshValueBtn))),e;var e,t},value:$,defaultExpanded:{}}):[(n=K(),o=n.firstChild,a(n,(()=>f.label),o),n)," ",(r=V(),a(r,(()=>(e=>{const t=Object.getOwnPropertyNames(Object(e)),i="bigint"==typeof e?`${e.toString()}n`:e;try{return JSON.stringify(i,t)}catch(M){return"unable to stringify"}})(t()))),i((()=>c(r,w().value))),r)];var r,n,o});var e,r,o,l})),i((()=>c(z,w().entry))),z;var F,z}const Z=e=>{const{colors:t,font:i,size:r}=P,{fontFamily:n,lineHeight:o,size:l}=i,a=e?j.bind({target:e}):j;return{entry:a`
      font-family: ${n.mono};
      font-size: ${l.xs};
      line-height: ${o.sm};
      outline: none;
      word-break: break-word;
    `,labelButton:a`
      cursor: pointer;
      color: inherit;
      font: inherit;
      outline: inherit;
      background: transparent;
      border: none;
      padding: 0;
    `,expander:a`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${r[3]};
      height: ${r[3]};
      padding-left: 3px;
      box-sizing: content-box;
    `,expanderIcon:e=>e?a`
          transform: rotate(90deg);
          transition: transform 0.1s ease;
        `:a`
        transform: rotate(0deg);
        transition: transform 0.1s ease;
      `,expandButton:a`
      display: flex;
      gap: ${r[1]};
      align-items: center;
      cursor: pointer;
      color: inherit;
      font: inherit;
      outline: inherit;
      background: transparent;
      border: none;
      padding: 0;
    `,value:a`
      color: ${t.purple[400]};
    `,subEntries:a`
      margin-left: ${r[2]};
      padding-left: ${r[2]};
      border-left: 2px solid ${t.darkGray[400]};
    `,info:a`
      color: ${t.gray[500]};
      font-size: ${l["2xs"]};
      padding-left: ${r[1]};
    `,refreshValueBtn:a`
      appearance: none;
      border: 0;
      cursor: pointer;
      background: transparent;
      color: inherit;
      padding: 0;
      font-family: ${n.mono};
      font-size: ${l.xs};
    `}};function Q(){const t=r(n),[i]=e(Z(t));return i}u(["click"]);var X=l("<div><div></div><div>/</div><div></div><div>/</div><div>");function ee(e){const t=[e/1e3,e/6e4,e/36e5,e/864e5];let i=0;for(let r=1;r<t.length&&!(t[r]<1);r++)i=r;return new Intl.NumberFormat(navigator.language,{compactDisplay:"short",notation:"compact",maximumFractionDigits:0}).format(t[i])+["s","min","h","d"][i]}function te({match:e,router:t}){const r=L();if(!e)return null;const n=t().looseRoutesById[e.routeId];if(!n.options.loader)return null;const o=Date.now()-e.updatedAt,l=n.options.staleTime??t().options.defaultStaleTime??0,s=n.options.gcTime??t().options.defaultGcTime??18e5;return d=X(),f=d.firstChild,u=f.nextSibling.nextSibling,p=u.nextSibling.nextSibling,a(f,(()=>ee(o))),a(u,(()=>ee(l))),a(p,(()=>ee(s))),i((()=>c(d,k(r().ageTicker(o>l))))),d;var d,f,u,p}var ie=l("<button type=button>➔");function re({to:e,params:t,search:r,router:n}){const o=L();return(l=ie()).$$click=i=>{i.stopPropagation(),n().navigate({to:e,params:t,search:r})},f(l,"title",`Navigate to ${e}`),i((()=>c(l,o().navigateButton))),l;var l}u(["click"]);var ne=l("<button><div>TANSTACK</div><div>TanStack Router v1"),oe=l("<div><div>"),le=l("<code> "),ae=l("<code>"),se=l("<div><div role=button><div>"),de=l("<div>"),ce=l('<div><button><svg xmlns=http://www.w3.org/2000/svg width=10 height=6 fill=none viewBox="0 0 10 6"><path stroke=currentColor stroke-linecap=round stroke-linejoin=round stroke-width=1.667 d="M1 1l4 4 4-4"></path></svg></button><div><div></div><div><div></div></div></div><div><div><div><span>Pathname</span></div><div><code></code></div><div><div><button type=button>Routes</button><button type=button>Matches</button></div><div><div>age / staleTime / gcTime</div></div></div><div>'),fe=l("<div><span>masked"),ue=l("<div role=button><div>"),pe=l("<div><div><div>Cached Matches</div><div>age / staleTime / gcTime</div></div><div>"),ge=l("<div><div>Match Details</div><div><div><div><div></div></div><div><div>ID:</div><div><code></code></div></div><div><div>State:</div><div></div></div><div><div>Last Updated:</div><div></div></div></div></div><div>Explorer</div><div>"),he=l("<div>Loader Data"),ve=l("<div><div>Search Params</div><div>");function xe(e){const{className:t,...r}=e,n=L();return o=ne(),l=o.firstChild,a=l.nextSibling,v(o,p(r,{get class(){return k(n().logo,t?t():"")}}),!1,!0),i((e=>{var t=n().tanstackLogo,i=n().routerLogo;return t!==e.e&&c(l,e.e=t),i!==e.t&&c(a,e.t=i),e}),{e:void 0,t:void 0}),o;var o,l,a}function me(e){return t=oe(),r=t.firstChild,t.style.setProperty("display","flex"),t.style.setProperty("align-items","center"),t.style.setProperty("width","100%"),a(t,(()=>e.left),r),r.style.setProperty("flex-grow","1"),r.style.setProperty("min-width","0"),a(r,(()=>e.children)),a(t,(()=>e.right),null),i((()=>c(t,e.class))),t;var t,r}function be({routerState:e,router:t,route:r,isRoot:n,activeId:l,setActiveId:u}){const p=L(),g=o((()=>e().pendingMatches||e().matches)),h=o((()=>e().matches.find((e=>e.routeId===r.id)))),v=o((()=>{var e,t;try{if(null==(e=h())?void 0:e.params){const e=null==(t=h())?void 0:t.params,i=r.path||F(r.id);if(i.startsWith("$")){const t=i.slice(1);if(e[t])return`(${e[t]})`}}return""}catch(i){return""}})),x=o((()=>{if(n)return;if(!r.path)return;const e=Object.assign({},...g().map((e=>e.params))),i=z({path:r.fullPath,params:e,leaveWildcards:!1,leaveParams:!1,decodeCharMap:t().pathParamsDecodeCharMap});return i.isMissingParams?void 0:i.interpolatedPath}));return $=se(),y=$.firstChild,w=y.firstChild,y.$$click=()=>{h()&&u(l()===r.id?"":r.id)},a(y,d(me,{get class(){return k(p().routesRow(!!h()))},get left(){return d(m,{get when(){return x()},children:e=>d(re,{get to(){return e()},router:t})})},get right(){return d(te,{get match(){return h()},router:t})},get children(){return[(t=le(),o=t.firstChild,a(t,(()=>n?U:r.path||F(r.id)),o),i((()=>c(t,p().code))),t),(e=ae(),a(e,v),i((()=>c(e,p().routeParamInfo))),e)];var e,t,o}}),null),a($,(b=s((()=>{var e;return!!(null==(e=r.children)?void 0:e.length)})),()=>{return b()?(o=de(),a(o,(()=>[...r.children].sort(((e,t)=>e.rank-t.rank)).map((i=>d(be,{routerState:e,router:t,route:i,activeId:l,setActiveId:u}))))),i((()=>c(o,p().nestedRouteRow(!!n)))),o):null;var o}),null),i((e=>{var t=`Open match details for ${r.id}`,i=k(p().routesRowContainer(r.id===l(),!!h())),n=k(p().matchIndicator(function(e,t){const i=e.find((e=>e.routeId===t.id));return i?C(i):"gray"}(g(),r)));return t!==e.e&&f(y,"aria-label",e.e=t),i!==e.t&&c(y,e.t=i),n!==e.a&&c(w,e.a=n),e}),{e:void 0,t:void 0,a:void 0}),$;var b,$,y,w}const $e=function({...e}){const{isOpen:t=!0,setIsOpen:r,handleDragStart:n,router:l,routerState:u,shadowDOMTarget:m,...b}=e,{onCloseClick:$}=g(),y=L(),{className:w,style:S,...F}=b;h(l);const[z,M]=R("tanstackRouterDevtoolsShowMatches",!0),[B,E]=R("tanstackRouterDevtoolsActiveRouteId",""),O=o((()=>[...u().pendingMatches??[],...u().matches,...u().cachedMatches].find((e=>e.routeId===B()||e.id===B())))),D=o((()=>Object.keys(u().location.search).length)),I=o((()=>({...l(),state:u()}))),G=o((()=>Object.fromEntries(function(e,t=[e=>e]){return e.map(((e,t)=>[e,t])).sort((([e,i],[r,n])=>{for(const o of t){const t=o(e),i=o(r);if(void 0===t){if(void 0===i)continue;return 1}if(t!==i)return t>i?1:-1}return i-n})).map((([e])=>e))}(Object.keys(I()),["state","routesById","routesByPath","flatRoutes","options","manifest"].map((e=>t=>t!==e))).map((e=>[e,I()[e]])).filter((e=>"function"!=typeof e[1]&&!["__store","basepath","injectedHtml","subscribers","latestLoadPromise","navigateTimeout","resetNextScroll","tempLocationKey","latestLocation","routeTree","history"].includes(e[0])))))),A=o((()=>{var e;return null==(e=O())?void 0:e.loaderData})),T=o((()=>O())),j=o((()=>u().location.search));return(()=>{var e=ce(),t=e.firstChild,o=t.firstChild,g=t.nextSibling,h=g.firstChild,m=h.nextSibling,b=m.firstChild,I=g.nextSibling,P=I.firstChild,L=P.firstChild;L.firstChild;var R,H,N,_,J,q,K,V=L.nextSibling,Y=V.firstChild,Z=V.nextSibling,Q=Z.firstChild,X=Q.firstChild,ee=X.nextSibling,ie=Q.nextSibling,ne=Z.nextSibling;return v(e,p({get class(){return k(y().devtoolsPanel,"TanStackRouterDevtoolsPanel",w?w():"")},get style(){return S?S():""}},F),!1,!0),a(e,n?(R=de(),x(R,"mousedown",n,!0),i((()=>c(R,y().dragHandle))),R):null,t),t.$$click=e=>{r&&r(!1),$(e)},a(h,d(xe,{"aria-hidden":!0,onClick:e=>{r&&r(!1),$(e)}})),a(b,d(W,{label:"Router",value:G,defaultExpanded:{state:{},context:{},options:{}},filterSubEntries:e=>e.filter((e=>"function"!=typeof e.value()))})),a(L,(H=s((()=>!!u().location.maskedLocation)),()=>{return H()?(e=fe(),t=e.firstChild,i((i=>{var r=y().maskedBadgeContainer,n=y().maskedBadge;return r!==i.e&&c(e,i.e=r),n!==i.t&&c(t,i.t=n),i}),{e:void 0,t:void 0}),e):null;var e,t}),null),a(Y,(()=>u().location.pathname)),a(V,(N=s((()=>!!u().location.maskedLocation)),()=>{return N()?(e=ae(),a(e,(()=>{var e;return null==(e=u().location.maskedLocation)?void 0:e.pathname})),i((()=>c(e,y().maskedLocation))),e):null;var e}),null),X.$$click=()=>{M(!1)},ee.$$click=()=>{M(!0)},a(ne,(_=s((()=>!z())),()=>{return _()?d(be,{routerState:u,router:l,get route(){return l().routeTree},isRoot:!0,activeId:B,setActiveId:E}):(e=de(),a(e,(()=>{var e,t;return null==(t=(null==(e=u().pendingMatches)?void 0:e.length)?u().pendingMatches:u().matches)?void 0:t.map(((e,t)=>{return r=ue(),n=r.firstChild,r.$$click=()=>E(B()===e.id?"":e.id),a(r,d(me,{get left(){return d(re,{get to(){return e.pathname},get params(){return e.params},get search(){return e.search},router:l})},get right(){return d(te,{match:e,router:l})},get children(){var t=ae();return a(t,(()=>`${e.routeId===U?U:e.pathname}`)),i((()=>c(t,y().matchID))),t}}),null),i((t=>{var i=`Open match details for ${e.id}`,o=k(y().matchRow(e===O())),l=k(y().matchIndicator(C(e)));return i!==t.e&&f(r,"aria-label",t.e=i),o!==t.t&&c(r,t.t=o),l!==t.a&&c(n,t.a=l),t}),{e:void 0,t:void 0,a:void 0}),r;var r,n}))})),e);var e})),a(I,(J=s((()=>!!u().cachedMatches.length)),()=>{return J()?(e=pe(),t=e.firstChild,r=t.firstChild.nextSibling,n=t.nextSibling,a(n,(()=>u().cachedMatches.map((e=>{return t=ue(),r=t.firstChild,t.$$click=()=>E(B()===e.id?"":e.id),a(t,d(me,{get left(){return d(re,{get to(){return e.pathname},get params(){return e.params},get search(){return e.search},router:l})},get right(){return d(te,{match:e,router:l})},get children(){var t=ae();return a(t,(()=>`${e.id}`)),i((()=>c(t,y().matchID))),t}}),null),i((i=>{var n=`Open match details for ${e.id}`,o=k(y().matchRow(e===O())),l=k(y().matchIndicator(C(e)));return n!==i.e&&f(t,"aria-label",i.e=n),o!==i.t&&c(t,i.t=o),l!==i.a&&c(r,i.a=l),i}),{e:void 0,t:void 0,a:void 0}),t;var t,r})))),i((i=>{var n=y().cachedMatchesContainer,o=y().detailsHeader,l=y().detailsHeaderInfo;return n!==i.e&&c(e,i.e=n),o!==i.t&&c(t,i.t=o),l!==i.a&&c(r,i.a=l),i}),{e:void 0,t:void 0,a:void 0}),e):null;var e,t,r,n}),null),a(e,(q=s((()=>{var e;return!(!O()||!(null==(e=O())?void 0:e.status))})),()=>{return q()?(o=ge(),l=o.firstChild,f=l.nextSibling,p=f.firstChild,g=p.firstChild,h=g.firstChild,v=g.nextSibling,x=v.firstChild.nextSibling,m=x.firstChild,b=v.nextSibling,$=b.firstChild.nextSibling,k=b.nextSibling,w=k.firstChild.nextSibling,C=f.nextSibling,S=C.nextSibling,a(h,(e=s((()=>{var e,t;return!("success"!==(null==(e=O())?void 0:e.status)||!(null==(t=O())?void 0:t.isFetching))})),()=>{var t;return e()?"fetching":null==(t=O())?void 0:t.status})),a(m,(()=>{var e;return null==(e=O())?void 0:e.id})),a($,(t=s((()=>{var e;return!!(null==(e=u().pendingMatches)?void 0:e.find((e=>{var t;return e.id===(null==(t=O())?void 0:t.id)})))})),()=>t()?"Pending":u().matches.find((e=>{var t;return e.id===(null==(t=O())?void 0:t.id)}))?"Active":"Cached")),a(w,(r=s((()=>{var e;return!!(null==(e=O())?void 0:e.updatedAt)})),()=>{var e;return r()?new Date(null==(e=O())?void 0:e.updatedAt).toLocaleTimeString():"N/A"})),a(o,(n=s((()=>!!A())),()=>{return n()?[(t=he(),i((()=>c(t,y().detailsHeader))),t),(e=de(),a(e,d(W,{label:"loaderData",value:A,defaultExpanded:{}})),i((()=>c(e,y().detailsContent))),e)]:null;var e,t}),C),a(S,d(W,{label:"Match",value:T,defaultExpanded:{}})),i((e=>{var t,i,r=y().thirdContainer,n=y().detailsHeader,a=y().matchDetails,s=y().matchStatus(null==(t=O())?void 0:t.status,null==(i=O())?void 0:i.isFetching),d=y().matchDetailsInfoLabel,f=y().matchDetailsInfo,u=y().matchDetailsInfoLabel,h=y().matchDetailsInfo,m=y().matchDetailsInfoLabel,F=y().matchDetailsInfo,z=y().detailsHeader,U=y().detailsContent;return r!==e.e&&c(o,e.e=r),n!==e.t&&c(l,e.t=n),a!==e.a&&c(p,e.a=a),s!==e.o&&c(g,e.o=s),d!==e.i&&c(v,e.i=d),f!==e.n&&c(x,e.n=f),u!==e.s&&c(b,e.s=u),h!==e.h&&c($,e.h=h),m!==e.r&&c(k,e.r=m),F!==e.d&&c(w,e.d=F),z!==e.l&&c(C,e.l=z),U!==e.u&&c(S,e.u=U),e}),{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0}),o):null;var e,t,r,n,o,l,f,p,g,h,v,x,m,b,$,k,w,C,S}),null),a(e,(K=s((()=>!!D())),()=>{return K()?(e=ve(),t=e.firstChild,r=t.nextSibling,a(r,d(W,{value:j,get defaultExpanded(){return Object.keys(u().location.search).reduce(((e,t)=>(e[t]={},e)),{})}})),i((i=>{var n=y().fourthContainer,o=y().detailsHeader,l=y().detailsContent;return n!==i.e&&c(e,i.e=n),o!==i.t&&c(t,i.t=o),l!==i.a&&c(r,i.a=l),i}),{e:void 0,t:void 0,a:void 0}),e):null;var e,t,r}),null),i((e=>{var i=y().panelCloseBtn,r=y().panelCloseBtnIcon,n=y().firstContainer,l=y().row,a=y().routerExplorerContainer,s=y().routerExplorer,d=y().secondContainer,u=y().matchesContainer,p=y().detailsHeader,v=y().detailsContent,x=y().detailsHeader,$=y().routeMatchesToggle,w=!z(),C=k(y().routeMatchesToggleBtn(!z(),!0)),S=z(),F=k(y().routeMatchesToggleBtn(!!z(),!1)),U=y().detailsHeaderInfo,M=k(y().routesContainer);return i!==e.e&&c(t,e.e=i),r!==e.t&&f(o,"class",e.t=r),n!==e.a&&c(g,e.a=n),l!==e.o&&c(h,e.o=l),a!==e.i&&c(m,e.i=a),s!==e.n&&c(b,e.n=s),d!==e.s&&c(I,e.s=d),u!==e.h&&c(P,e.h=u),p!==e.r&&c(L,e.r=p),v!==e.d&&c(V,e.d=v),x!==e.l&&c(Z,e.l=x),$!==e.u&&c(Q,e.u=$),w!==e.c&&(X.disabled=e.c=w),C!==e.w&&c(X,e.w=C),S!==e.m&&(ee.disabled=e.m=S),F!==e.f&&c(ee,e.f=F),U!==e.y&&c(ie,e.y=U),M!==e.g&&c(ne,e.g=M),e}),{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0,c:void 0,w:void 0,m:void 0,f:void 0,y:void 0,g:void 0}),e})()};u(["click","mousedown"]);var ye=l('<svg xmlns=http://www.w3.org/2000/svg enable-background="new 0 0 634 633"viewBox="0 0 634 633"><g transform=translate(1)><linearGradient x1=-641.486 x2=-641.486 y1=856.648 y2=855.931 gradientTransform="matrix(633 0 0 -633 406377 542258)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#6bdaff></stop><stop offset=0.319 stop-color=#f9ffb5></stop><stop offset=0.706 stop-color=#ffa770></stop><stop offset=1 stop-color=#ff7373></stop></linearGradient><circle cx=316.5 cy=316.5 r=316.5 fill-rule=evenodd clip-rule=evenodd></circle><defs><filter width=454 height=396.9 x=-137.5 y=412 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=454 height=396.9 x=-137.5 y=412 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><ellipse cx=89.5 cy=610.5 fill=#015064 fill-rule=evenodd stroke=#00CFE2 stroke-width=25 clip-rule=evenodd rx=214.5 ry=186></ellipse><defs><filter width=454 height=396.9 x=316.5 y=412 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=454 height=396.9 x=316.5 y=412 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><ellipse cx=543.5 cy=610.5 fill=#015064 fill-rule=evenodd stroke=#00CFE2 stroke-width=25 clip-rule=evenodd rx=214.5 ry=186></ellipse><defs><filter width=454 height=396.9 x=-137.5 y=450 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=454 height=396.9 x=-137.5 y=450 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><ellipse cx=89.5 cy=648.5 fill=#015064 fill-rule=evenodd stroke=#00A8B8 stroke-width=25 clip-rule=evenodd rx=214.5 ry=186></ellipse><defs><filter width=454 height=396.9 x=316.5 y=450 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=454 height=396.9 x=316.5 y=450 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><ellipse cx=543.5 cy=648.5 fill=#015064 fill-rule=evenodd stroke=#00A8B8 stroke-width=25 clip-rule=evenodd rx=214.5 ry=186></ellipse><defs><filter width=454 height=396.9 x=-137.5 y=486 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=454 height=396.9 x=-137.5 y=486 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><ellipse cx=89.5 cy=684.5 fill=#015064 fill-rule=evenodd stroke=#007782 stroke-width=25 clip-rule=evenodd rx=214.5 ry=186></ellipse><defs><filter width=454 height=396.9 x=316.5 y=486 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=454 height=396.9 x=316.5 y=486 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><ellipse cx=543.5 cy=684.5 fill=#015064 fill-rule=evenodd stroke=#007782 stroke-width=25 clip-rule=evenodd rx=214.5 ry=186></ellipse><defs><filter width=176.9 height=129.3 x=272.2 y=308 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=176.9 height=129.3 x=272.2 y=308 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><g><path fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11 d="M436 403.2l-5 28.6m-140-90.3l-10.9 62m52.8-19.4l-4.3 27.1"></path><linearGradient x1=-645.656 x2=-646.499 y1=854.878 y2=854.788 gradientTransform="matrix(-184.159 -32.4722 11.4608 -64.9973 -128419.844 34938.836)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ee2700></stop><stop offset=1 stop-color=#ff008e></stop></linearGradient><path fill-rule=evenodd d="M344.1 363l97.7 17.2c5.8 2.1 8.2 6.2 7.1 12.1-1 5.9-4.7 9.2-11 9.9l-106-18.7-57.5-59.2c-3.2-4.8-2.9-9.1.8-12.8 3.7-3.7 8.3-4.4 13.7-2.1l55.2 53.6z"clip-rule=evenodd></path><path fill=#D8D8D8 fill-rule=evenodd stroke=#FFF stroke-linecap=round stroke-linejoin=bevel stroke-width=7 d="M428.3 384.5l.9-6.5m-33.9 1.5l.9-6.5m-34 .5l.9-6.1m-38.9-16.1l4.2-3.9m-25.2-16.1l4.2-3.9"clip-rule=evenodd></path></g><defs><filter width=280.6 height=317.4 x=73.2 y=113.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=280.6 height=317.4 x=73.2 y=113.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><g><linearGradient x1=-646.8 x2=-646.8 y1=854.844 y2=853.844 gradientTransform="matrix(-100.1751 48.8587 -97.9753 -200.879 19124.773 203538.61)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#a17500></stop><stop offset=1 stop-color=#5d2100></stop></linearGradient><path fill-rule=evenodd d="M192.3 203c8.1 37.3 14 73.6 17.8 109.1 3.8 35.4 2.8 75.2-2.9 119.2l61.2-16.7c-15.6-59-25.2-97.9-28.6-116.6-3.4-18.7-10.8-51.8-22.2-99.6l-25.3 4.6"clip-rule=evenodd></path><linearGradient x1=-635.467 x2=-635.467 y1=852.115 y2=851.115 gradientTransform="matrix(92.6873 4.8575 2.0257 -38.6535 57323.695 36176.047)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#2f8a00></stop><stop offset=1 stop-color=#90ff57></stop></linearGradient><path fill-rule=evenodd stroke=#2F8A00 stroke-width=13 d="M195 183.9s-12.6-22.1-36.5-29.9c-15.9-5.2-34.4-1.5-55.5 11.1 15.9 14.3 29.5 22.6 40.7 24.9 16.8 3.6 51.3-6.1 51.3-6.1z"clip-rule=evenodd></path><linearGradient x1=-636.573 x2=-636.573 y1=855.444 y2=854.444 gradientTransform="matrix(109.9945 5.7646 6.3597 -121.3507 64719.133 107659.336)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#2f8a00></stop><stop offset=1 stop-color=#90ff57></stop></linearGradient><path fill-rule=evenodd stroke=#2F8A00 stroke-width=13 d="M194.9 184.5s-47.5-8.5-83.2 15.7c-23.8 16.2-34.3 49.3-31.6 99.3 30.3-27.8 52.1-48.5 65.2-61.9 19.8-20 49.6-53.1 49.6-53.1z"clip-rule=evenodd></path><linearGradient x1=-632.145 x2=-632.145 y1=854.174 y2=853.174 gradientTransform="matrix(62.9558 3.2994 3.5021 -66.8246 37035.367 59284.227)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#2f8a00></stop><stop offset=1 stop-color=#90ff57></stop></linearGradient><path fill-rule=evenodd stroke=#2F8A00 stroke-width=13 d="M195 183.9c-.8-21.9 6-38 20.6-48.2 14.6-10.2 29.8-15.3 45.5-15.3-6.1 21.4-14.5 35.8-25.2 43.4-10.7 7.5-24.4 14.2-40.9 20.1z"clip-rule=evenodd></path><linearGradient x1=-638.224 x2=-638.224 y1=853.801 y2=852.801 gradientTransform="matrix(152.4666 7.9904 3.0934 -59.0251 94939.86 55646.855)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#2f8a00></stop><stop offset=1 stop-color=#90ff57></stop></linearGradient><path fill-rule=evenodd stroke=#2F8A00 stroke-width=13 d="M194.9 184.5c31.9-30 64.1-39.7 96.7-29 32.6 10.7 50.8 30.4 54.6 59.1-35.2-5.5-60.4-9.6-75.8-12.1-15.3-2.6-40.5-8.6-75.5-18z"clip-rule=evenodd></path><linearGradient x1=-637.723 x2=-637.723 y1=855.103 y2=854.103 gradientTransform="matrix(136.467 7.1519 5.2165 -99.5377 82830.875 89859.578)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#2f8a00></stop><stop offset=1 stop-color=#90ff57></stop></linearGradient><path fill-rule=evenodd stroke=#2F8A00 stroke-width=13 d="M194.9 184.5c35.8-7.6 65.6-.2 89.2 22 23.6 22.2 37.7 49 42.3 80.3-39.8-9.7-68.3-23.8-85.5-42.4-17.2-18.5-32.5-38.5-46-59.9z"clip-rule=evenodd></path><linearGradient x1=-631.79 x2=-631.79 y1=855.872 y2=854.872 gradientTransform="matrix(60.8683 3.19 8.7771 -167.4773 31110.818 145537.61)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#2f8a00></stop><stop offset=1 stop-color=#90ff57></stop></linearGradient><path fill-rule=evenodd stroke=#2F8A00 stroke-width=13 d="M194.9 184.5c-33.6 13.8-53.6 35.7-60.1 65.6-6.5 29.9-3.6 63.1 8.7 99.6 27.4-40.3 43.2-69.6 47.4-88 4.2-18.3 5.5-44.1 4-77.2z"clip-rule=evenodd></path><path fill=none stroke=#2F8A00 stroke-linecap=round stroke-width=8 d="M196.5 182.3c-14.8 21.6-25.1 41.4-30.8 59.4-5.7 18-9.4 33-11.1 45.1"></path><path fill=none stroke=#2F8A00 stroke-linecap=round stroke-width=8 d="M194.8 185.7c-24.4 1.7-43.8 9-58.1 21.8-14.3 12.8-24.7 25.4-31.3 37.8m99.1-68.9c29.7-6.7 52-8.4 67-5 15 3.4 26.9 8.7 35.8 15.9m-110.8-5.9c20.3 9.9 38.2 20.5 53.9 31.9 15.7 11.4 27.4 22.1 35.1 32"></path></g><defs><filter width=532 height=633 x=50.5 y=399 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=532 height=633 x=50.5 y=399 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><linearGradient x1=-641.104 x2=-641.278 y1=856.577 y2=856.183 gradientTransform="matrix(532 0 0 -633 341484.5 542657)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#fff400></stop><stop offset=1 stop-color=#3c8700></stop></linearGradient><ellipse cx=316.5 cy=715.5 fill-rule=evenodd clip-rule=evenodd rx=266 ry=316.5></ellipse><defs><filter width=288 height=283 x=391 y=-24 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"></feColorMatrix></filter></defs><mask width=288 height=283 x=391 y=-24 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#FFF fill-rule=evenodd clip-rule=evenodd></circle></g></mask><g><g transform="translate(397 -24)"><linearGradient x1=-1036.672 x2=-1036.672 y1=880.018 y2=879.018 gradientTransform="matrix(227 0 0 -227 235493 199764)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffdf00></stop><stop offset=1 stop-color=#ff9d00></stop></linearGradient><circle cx=168.5 cy=113.5 r=113.5 fill-rule=evenodd clip-rule=evenodd></circle><linearGradient x1=-1017.329 x2=-1018.602 y1=658.003 y2=657.998 gradientTransform="matrix(30 0 0 -1 30558 771)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M30 113H0"></path><linearGradient x1=-1014.501 x2=-1015.774 y1=839.985 y2=839.935 gradientTransform="matrix(26.5 0 0 -5.5 26925 4696.5)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M33.5 79.5L7 74"></path><linearGradient x1=-1016.59 x2=-1017.862 y1=852.671 y2=852.595 gradientTransform="matrix(29 0 0 -8 29523 6971)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M34 146l-29 8"></path><linearGradient x1=-1011.984 x2=-1013.257 y1=863.523 y2=863.229 gradientTransform="matrix(24 0 0 -13 24339 11407)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M45 177l-24 13"></path><linearGradient x1=-1006.673 x2=-1007.946 y1=869.279 y2=868.376 gradientTransform="matrix(20 0 0 -19 20205 16720)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M67 204l-20 19"></path><linearGradient x1=-992.85 x2=-993.317 y1=871.258 y2=870.258 gradientTransform="matrix(13.8339 0 0 -22.8467 13825.796 20131.938)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M94.4 227l-13.8 22.8"></path><linearGradient x1=-953.835 x2=-953.965 y1=871.9 y2=870.9 gradientTransform="matrix(7.5 0 0 -24.5 7278 21605)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M127.5 243.5L120 268"></path><linearGradient x1=244.504 x2=244.496 y1=871.898 y2=870.898 gradientTransform="matrix(.5 0 0 -24.5 45.5 21614)"gradientUnits=userSpaceOnUse><stop offset=0 stop-color=#ffa400></stop><stop offset=1 stop-color=#ff5e00></stop></linearGradient><path fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12 d="M167.5 252.5l.5 24.5">');function ke(){const e=b();return t=ye(),i=t.firstChild.firstChild,r=i.nextSibling,n=r.nextSibling,o=n.firstChild,l=n.nextSibling,a=l.firstChild,s=l.nextSibling,d=s.nextSibling,c=d.firstChild,u=d.nextSibling,p=u.firstChild,g=u.nextSibling,h=g.nextSibling,v=h.firstChild,x=h.nextSibling,m=x.firstChild,$=x.nextSibling,y=$.nextSibling,k=y.firstChild,w=y.nextSibling,C=w.firstChild,S=w.nextSibling,F=S.nextSibling,z=F.firstChild,U=F.nextSibling,M=U.firstChild,B=U.nextSibling,E=B.nextSibling,O=E.firstChild,D=E.nextSibling,I=D.firstChild,G=D.nextSibling,A=G.nextSibling,T=A.firstChild,j=A.nextSibling,P=j.firstChild,L=j.nextSibling,R=L.firstChild.nextSibling,H=R.nextSibling,N=L.nextSibling,_=N.firstChild,J=N.nextSibling,q=J.firstChild,K=J.nextSibling,V=K.firstChild,Y=V.nextSibling,W=Y.nextSibling,Z=W.nextSibling,Q=Z.nextSibling,X=Q.nextSibling,ee=X.nextSibling,te=ee.nextSibling,ie=te.nextSibling,re=ie.nextSibling,ne=re.nextSibling,oe=ne.nextSibling,le=oe.nextSibling,ae=le.nextSibling,se=K.nextSibling,de=se.firstChild,ce=se.nextSibling,fe=ce.firstChild,ue=ce.nextSibling,pe=ue.nextSibling,ge=pe.nextSibling,he=ge.firstChild,ve=ge.nextSibling,xe=ve.firstChild,me=ve.nextSibling,be=me.firstChild.firstChild,$e=be.nextSibling,ke=$e.nextSibling,we=ke.nextSibling,Ce=we.nextSibling,Se=Ce.nextSibling,Fe=Se.nextSibling,ze=Fe.nextSibling,Ue=ze.nextSibling,Me=Ue.nextSibling,Be=Me.nextSibling,Ee=Be.nextSibling,Oe=Ee.nextSibling,De=Oe.nextSibling,Ie=De.nextSibling,Ge=Ie.nextSibling,Ae=Ge.nextSibling,Te=Ae.nextSibling,f(i,"id",`a-${e}`),f(r,"fill",`url(#a-${e})`),f(o,"id",`b-${e}`),f(l,"id",`c-${e}`),f(a,"filter",`url(#b-${e})`),f(s,"mask",`url(#c-${e})`),f(c,"id",`d-${e}`),f(u,"id",`e-${e}`),f(p,"filter",`url(#d-${e})`),f(g,"mask",`url(#e-${e})`),f(v,"id",`f-${e}`),f(x,"id",`g-${e}`),f(m,"filter",`url(#f-${e})`),f($,"mask",`url(#g-${e})`),f(k,"id",`h-${e}`),f(w,"id",`i-${e}`),f(C,"filter",`url(#h-${e})`),f(S,"mask",`url(#i-${e})`),f(z,"id",`j-${e}`),f(U,"id",`k-${e}`),f(M,"filter",`url(#j-${e})`),f(B,"mask",`url(#k-${e})`),f(O,"id",`l-${e}`),f(D,"id",`m-${e}`),f(I,"filter",`url(#l-${e})`),f(G,"mask",`url(#m-${e})`),f(T,"id",`n-${e}`),f(j,"id",`o-${e}`),f(P,"filter",`url(#n-${e})`),f(L,"mask",`url(#o-${e})`),f(R,"id",`p-${e}`),f(H,"fill",`url(#p-${e})`),f(_,"id",`q-${e}`),f(J,"id",`r-${e}`),f(q,"filter",`url(#q-${e})`),f(K,"mask",`url(#r-${e})`),f(V,"id",`s-${e}`),f(Y,"fill",`url(#s-${e})`),f(W,"id",`t-${e}`),f(Z,"fill",`url(#t-${e})`),f(Q,"id",`u-${e}`),f(X,"fill",`url(#u-${e})`),f(ee,"id",`v-${e}`),f(te,"fill",`url(#v-${e})`),f(ie,"id",`w-${e}`),f(re,"fill",`url(#w-${e})`),f(ne,"id",`x-${e}`),f(oe,"fill",`url(#x-${e})`),f(le,"id",`y-${e}`),f(ae,"fill",`url(#y-${e})`),f(de,"id",`z-${e}`),f(ce,"id",`A-${e}`),f(fe,"filter",`url(#z-${e})`),f(ue,"id",`B-${e}`),f(pe,"fill",`url(#B-${e})`),f(pe,"mask",`url(#A-${e})`),f(he,"id",`C-${e}`),f(ve,"id",`D-${e}`),f(xe,"filter",`url(#C-${e})`),f(me,"mask",`url(#D-${e})`),f(be,"id",`E-${e}`),f($e,"fill",`url(#E-${e})`),f(ke,"id",`F-${e}`),f(we,"stroke",`url(#F-${e})`),f(Ce,"id",`G-${e}`),f(Se,"stroke",`url(#G-${e})`),f(Fe,"id",`H-${e}`),f(ze,"stroke",`url(#H-${e})`),f(Ue,"id",`I-${e}`),f(Me,"stroke",`url(#I-${e})`),f(Be,"id",`J-${e}`),f(Ee,"stroke",`url(#J-${e})`),f(Oe,"id",`K-${e}`),f(De,"stroke",`url(#K-${e})`),f(Ie,"id",`L-${e}`),f(Ge,"stroke",`url(#L-${e})`),f(Ae,"id",`M-${e}`),f(Te,"stroke",`url(#M-${e})`),t;var t,i,r,n,o,l,a,s,d,c,u,p,g,h,v,x,m,$,y,k,w,C,S,F,z,U,M,B,E,O,D,I,G,A,T,j,P,L,R,H,N,_,J,q,K,V,Y,W,Z,Q,X,ee,te,ie,re,ne,oe,le,ae,se,de,ce,fe,ue,pe,ge,he,ve,xe,me,be,$e,ke,we,Ce,Se,Fe,ze,Ue,Me,Be,Ee,Oe,De,Ie,Ge,Ae,Te}var we=l("<button type=button><div><div></div><div></div></div><div>-</div><div>TanStack Router");function Ce({initialIsOpen:r,panelProps:n={},closeButtonProps:l={},toggleButtonProps:s={},position:f="bottom-left",containerElement:u="footer",router:g,routerState:h,shadowDOMTarget:x}){const[m,b]=e();let C;const[S,F]=R("tanstackRouterDevtoolsOpen",r),[z,U]=R("tanstackRouterDevtoolsHeight",null),[M,B]=e(!1),[E,O]=e(!1),D=function(){const[r,n]=e(!1);return(w?t:i)((()=>{n(!0)})),r}(),I=L();S(),t((()=>{B(S()??!1)})),t((()=>{var e,t,i;if(M()){const i=null==(t=null==(e=m())?void 0:e.parentElement)?void 0:t.style.paddingBottom,r=()=>{var e;const t=C.getBoundingClientRect().height;(null==(e=m())?void 0:e.parentElement)&&b((e=>((null==e?void 0:e.parentElement)&&(e.parentElement.style.paddingBottom=`${t}px`),e)))};if(r(),"undefined"!=typeof window)return window.addEventListener("resize",r),()=>{var e;window.removeEventListener("resize",r),(null==(e=m())?void 0:e.parentElement)&&"string"==typeof i&&b((e=>(e.parentElement.style.paddingBottom=i,e)))}}else(null==(i=m())?void 0:i.parentElement)&&b((e=>((null==e?void 0:e.parentElement)&&e.parentElement.removeAttribute("style"),e)))})),t((()=>{if(m()){const e=m(),t=getComputedStyle(e).fontSize;null==e||e.style.setProperty("--tsrd-font-size",t)}}));const{style:G={},...A}=n,{style:T={},onClick:j,...P}=l,{onClick:H,class:N,..._}=s;if(!D())return null;const J=o((()=>z()??500)),q=o((()=>k(I().devtoolsPanelContainer,I().devtoolsPanelContainerVisibility(!!S()),I().devtoolsPanelContainerResizing(E),I().devtoolsPanelContainerAnimation(M(),J()+16)))),K=o((()=>({height:`${J()}px`,...G||{}}))),V=o((()=>k(I().mainCloseBtn,I().mainCloseBtnPosition(f),I().mainCloseBtnAnimation(!!S()),N)));return d(y,{component:u,ref:b,class:"TanStackRouterDevtools",get children(){return[d($.Provider,{value:{onCloseClick:j??(()=>{})},get children(){return d($e,p({ref(e){"function"==typeof C?C(e):C=e}},A,{router:g,routerState:h,className:q,style:K,get isOpen(){return M()},setIsOpen:F,handleDragStart:e=>((e,t)=>{if(0!==t.button)return;O(!0);const i=(null==e?void 0:e.getBoundingClientRect().height)??0,r=t.pageY,n=e=>{const t=r-e.pageY,n=i+t;U(n),F(!(n<70))},o=()=>{O(!1),document.removeEventListener("mousemove",n),document.removeEventListener("mouseUp",o)};document.addEventListener("mousemove",n),document.addEventListener("mouseup",o)})(C,e),shadowDOMTarget:x}))}}),(e=we(),t=e.firstChild,r=t.firstChild,n=r.nextSibling,o=t.nextSibling,l=o.nextSibling,v(e,p(_,{"aria-label":"Open TanStack Router Devtools",onClick:e=>{F(!0),H&&H(e)},get class(){return V()}}),!1,!0),a(r,d(ke,{})),a(n,d(ke,{})),i((e=>{var i=I().mainCloseBtnIconContainer,a=I().mainCloseBtnIconOuter,s=I().mainCloseBtnIconInner,d=I().mainCloseBtnDivider,f=I().routerLogoCloseButton;return i!==e.e&&c(t,e.e=i),a!==e.t&&c(r,e.t=a),s!==e.a&&c(n,e.a=s),d!==e.o&&c(o,e.o=d),f!==e.i&&c(l,e.i=f),e}),{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0}),e)];var e,t,r,n,o,l}})}export{Ce as FloatingTanStackRouterDevtools,Ce as default};
