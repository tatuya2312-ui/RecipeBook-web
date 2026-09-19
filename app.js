const VERSION="26.3";
const FALLBACK_VERSION="26.3-snapshot-10";
const ASSET_BASE="https://assets.mcasset.cloud/"+VERSION;
const FALLBACK_ASSET_BASE="https://assets.mcasset.cloud/"+FALLBACK_VERSION;
const RENDER_BASE="https://raw.githubusercontent.com/Owen1212055/mc-assets/main/item-assets";
const ASSET_TREE_URL="https://api.github.com/repos/Owen1212055/mc-assets/git/trees/main?recursive=1";
const CATEGORIES=["すべて","建築","装飾","レッドストーン","道具","戦闘","防具","食料","素材","移動","精錬・調理","醸造","その他"];

let ja={}, en={}, summaries=[], uniqueItems=[], assetSet=new Set();
let searchQuery="", selectedCategory="すべて";
const recipeCache=new Map();
const tagCache=new Map();
const app=document.getElementById("app");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function cleanId(id){return String(id||"").split(":").pop();}
function pretty(id){return cleanId(id).replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
function renderUrl(id){return RENDER_BASE+"/"+cleanId(id).toUpperCase()+".png";}
function nameJa(id){const x=cleanId(id);return ja["item.minecraft."+x]||ja["block.minecraft."+x]||pretty(x);}
function nameEn(id){const x=cleanId(id);return en["item.minecraft."+x]||en["block.minecraft."+x]||pretty(x);}
function hasAsset(id){return assetSet.has(cleanId(id).toUpperCase()+".PNG");}
async function fetchJson(url){const r=await fetch(url);if(!r.ok)throw new Error("HTTP "+r.status+" : "+url);return r.json();}
async function fetchJsonFromBases(relativePath){
  let lastError=null;
  for(const base of [ASSET_BASE,FALLBACK_ASSET_BASE]){
    try{return await fetchJson(base+"/"+relativePath);}catch(e){lastError=e;}
  }
  throw lastError||new Error("Minecraft data not found");
}

function guessOutputId(recipeId){
  let id=recipeId;
  if(id.includes("_from_")) id=id.split("_from_")[0];
  ["_smithing_trim","_smithing","_from_smelting","_from_blasting","_from_smoking","_from_campfire_cooking","_from_stonecutting"].forEach(s=>{if(id.endsWith(s))id=id.slice(0,-s.length);});
  if(id==="map_cloning")return"filled_map";
  if(id==="book_cloning")return"written_book";
  if(id==="repair_item")return"anvil";
  if(id==="armor_dye")return"leather_chestplate";
  if(id==="firework_star_fade")return"firework_star";
  return id;
}

function categoryOf(recipeId,output){
  const id=output.toLowerCase(),r=recipeId.toLowerCase();
  if(r.includes("smelting")||r.includes("blasting")||r.includes("smoking")||r.includes("campfire"))return"精錬・調理";
  if(r.includes("brewing")||id.includes("potion"))return"醸造";
  if(id.includes("cushion")||id==="straw_bed")return"装飾";
  if(id.includes("poplar")||((id.includes("wool")||id.includes("concrete"))&&(id.includes("stairs")||id.includes("slab"))))return"建築";
  if(/sword|bow|crossbow|trident|mace|spear|shield|arrow/.test(id))return"戦闘";
  if(/pickaxe|axe|shovel|hoe|shears|fishing_rod|brush|flint_and_steel|compass|clock|spyglass/.test(id))return"道具";
  if(/helmet|chestplate|leggings|boots|elytra|armor/.test(id))return"防具";
  if(/bread|apple|stew|cookie|cake|pie|beef|pork|chicken|mutton|rabbit|cod|salmon|carrot|potato|beetroot|melon|berries|honey|kelp|chorus/.test(id))return"食料";
  if(/minecart|boat|saddle/.test(id))return"移動";
  if(/redstone|piston|observer|repeater|comparator|hopper|dispenser|dropper|lever|rail|crafter|target|daylight_detector/.test(id))return"レッドストーン";
  if(/ingot|nugget|diamond|emerald|coal|charcoal|lapis|quartz|amethyst|shard|rod|string|leather|paper|stick|brick|dye|powder/.test(id))return"素材";
  if(/banner|painting|carpet|wool|glass|terracotta|concrete|candle|flower_pot|item_frame|sign|shelf|bed|decorated_pot/.test(id))return"装飾";
  if(/planks|stairs|slab|wall|fence|door|trapdoor|bricks|stone|deepslate|copper|wood|log|sandstone|quartz_block|prismarine|purpur/.test(id))return"建築";
  return"その他";
}

function isDisplayable(id){
  const x=cleanId(id);
  const named=ja["item.minecraft."+x]||ja["block.minecraft."+x]||en["item.minecraft."+x]||en["block.minecraft."+x];
  if(!named||!hasAsset(x))return false;
  const technical=new Set(["air","cave_air","void_air","water","lava","fire","soul_fire","nether_portal","end_portal","end_gateway","moving_piston","piston_head","wall_torch","redstone_wall_torch","tripwire","attached_melon_stem","attached_pumpkin_stem"]);
  return !technical.has(x);
}

function recipeRank(s){
  if(s.recipeId.startsWith("__item__:"))return 3;
  if(s.recipeId===s.outputGuess)return 0;
  if(!s.recipeId.includes("_from_")&&!/smelting|blasting|smoking|campfire/.test(s.recipeId))return 1;
  return 2;
}
function buildUniqueItems(){
  const groups=new Map();
  summaries.forEach(s=>{const k=cleanId(s.outputGuess);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);});
  uniqueItems=[...groups.values()].map(arr=>arr.sort((a,b)=>recipeRank(a)-recipeRank(b)||a.recipeId.length-b.recipeId.length)[0]);
  uniqueItems.sort((a,b)=>a.jaName.localeCompare(b.jaName,"ja"));
}

function topbar(title,subtitle,back){
  return '<header class="topbar">'+
    (back?'<button class="back-btn" id="backBtn">‹ 戻る</button>':'<img class="logo" src="'+renderUrl("crafting_table")+'" alt="">')+
    '<div class="title-wrap"><div class="title">'+esc(title)+'</div><div class="subtitle">'+esc(subtitle||"Minecraft Java 26.3・非公式")+'</div></div></header>';
}
function slot(id,sizeClass,qty,clickable){
  if(!id)return '<div class="slot '+(sizeClass||"")+'"></div>';
  return '<div class="slot '+(sizeClass||"")+'" '+(clickable?'data-item="'+esc(cleanId(id))+'" role="button" tabindex="0"':'')+'>'+
    '<img src="'+renderUrl(id)+'" alt="'+esc(nameJa(id))+'">'+
    (qty&&qty>1?'<span class="qty">'+qty+'</span>':'')+'</div>';
}
function navigate(state){history.pushState(state,"","#"+state.page);renderState(state);}
function goBack(){history.back();}
window.addEventListener("popstate",e=>renderState(e.state||{page:"home"}));

function renderHome(){
  const q=searchQuery.trim().toLowerCase();
  const filtered=uniqueItems.filter(s=>{
    const catOk=selectedCategory==="すべて"||s.category===selectedCategory;
    const qOk=!q||s.jaName.toLowerCase().includes(q)||s.enName.toLowerCase().includes(q)||cleanId(s.outputGuess).toLowerCase().includes(q);
    return catOk&&qOk;
  });
  app.innerHTML=topbar("RecipeBook","Minecraft Java 26.3・非公式",false)+
    '<main class="content"><input class="search" id="search" placeholder="日本語・英語・IDで検索" value="'+esc(searchQuery)+'">'+
    '<div class="chips">'+CATEGORIES.map(c=>'<button class="chip '+(c===selectedCategory?'active':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>').join("")+'</div>'+
    '<div class="install-hint">iPhoneではSafariの共有ボタン →「ホーム画面に追加」でアプリ風に使えます。</div>'+
    '<div class="count">'+filtered.length+'件</div><div class="list">'+filtered.map(s=>
      '<button class="item-row" data-open-item="'+esc(cleanId(s.outputGuess))+'">'+
      slot(s.outputGuess,"small",1,false)+
      '<div class="item-main"><div class="item-ja">'+esc(s.jaName)+'</div><div class="item-en">'+esc(s.enName)+'</div>'+
      '<div class="meta"><span class="badge">'+esc(s.category)+'</span><span class="id">'+esc(cleanId(s.outputGuess))+'</span></div></div><div class="chev">›</div></button>'
    ).join("")+'</div></main>';

  const inp=document.getElementById("search");
  inp.addEventListener("input",e=>{searchQuery=e.target.value;renderHome();requestAnimationFrame(()=>{const n=document.getElementById("search");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}});});
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.cat;renderHome();});
  document.querySelectorAll("[data-open-item]").forEach(b=>b.onclick=()=>navigate({page:"item",itemId:b.dataset.openItem}));
}

function acquisitionTips(id,hasRecipe){
  const x=cleanId(id),tips=[];
  if(hasRecipe)tips.push("上のクラフト・加工レシピから作成できます。");
  if(x.endsWith("_spawn_egg"))tips.push("スポーンエッグは通常のサバイバルでは入手できません。クリエイティブまたはコマンドで入手します。");
  else if(["command_block","chain_command_block","repeating_command_block","barrier","structure_block","structure_void","jigsaw","light","debug_stick"].includes(x))tips.push("通常のサバイバルでは入手できません。クリエイティブまたはコマンドで入手します。");
  else if(x.endsWith("_ore"))tips.push("地下・洞窟などに生成される鉱石を、適切なツルハシで採掘して入手します。");
  else if(["diamond","coal","emerald","lapis_lazuli","raw_iron","raw_copper","raw_gold","redstone"].includes(x))tips.push("対応する鉱石を採掘して入手します。幸運エンチャントが有効なものもあります。");
  else if(x==="ancient_debris")tips.push("ネザーの地下で古代の残骸を採掘して入手します。ダイヤモンド以上のツルハシが必要です。");
  else if(/_log$|_wood$|_stem$|_hyphae$/.test(x))tips.push("対応する木・巨大キノコ系の幹を伐採して入手します。");
  else if(x.endsWith("_leaves"))tips.push("葉ブロックをハサミ、またはシルクタッチ付きの道具で壊して入手します。");
  else if(x.endsWith("_sapling"))tips.push("対応する木の葉を壊したり自然消滅させたりするとドロップします。");
  else if(["bone","arrow"].includes(x))tips.push("主にスケルトン系モブのドロップから入手します。");
  else if(x==="rotten_flesh")tips.push("主にゾンビ系モブのドロップから入手します。");
  else if(x==="gunpowder")tips.push("主にクリーパー、ガスト、ウィッチなどのドロップから入手します。");
  else if(x==="string")tips.push("主にクモ・洞窟グモのドロップ、クモの巣、構造物の戦利品などから入手します。");
  else if(x==="ender_pearl")tips.push("主にエンダーマンのドロップやピグリン交易などから入手します。");
  else if(x==="blaze_rod")tips.push("ネザー要塞に出現するブレイズを倒して入手します。");
  else if(x==="breeze_rod")tips.push("トライアルチャンバーに出現するブリーズを倒して入手します。");
  else if(x==="slime_ball")tips.push("スライムを倒す、またはパンダのくしゃみなどで入手できます。");
  else if(x==="magma_cream")tips.push("マグマキューブのドロップから入手できます。");
  else if(x==="ghast_tear")tips.push("ガストを倒すとドロップします。");
  else if(x==="phantom_membrane")tips.push("ファントムを倒すとドロップします。");
  else if(x==="nether_star")tips.push("ウィザーを倒すと入手できます。");
  else if(x==="elytra")tips.push("エンドシティのエンドシップ内で入手します。");
  else if(x==="totem_of_undying")tips.push("エヴォーカーを倒すと入手できます。");
  else if(x==="obsidian")tips.push("水で溶岩源を冷やして生成し、ダイヤモンド以上のツルハシで採掘します。");
  else if(["stone","cobblestone","deepslate","cobbled_deepslate","dirt","sand","red_sand","gravel","clay","netherrack","end_stone"].includes(x))tips.push("ワールド内に自然生成されるブロックを採掘して入手します。");
  if(!hasRecipe&&tips.length===0)tips.push("通常のクラフトレシピはありません。自然生成、採掘、モブドロップ、栽培、交易、釣り、構造物の戦利品などから入手するタイプです。");
  return [...new Set(tips)];
}

async function renderItem(id){
  const clean=cleanId(id);
  const recipes=summaries.filter(s=>!s.recipeId.startsWith("__item__:")&&cleanId(s.outputGuess)===clean);
  const details=await Promise.all(recipes.map(r=>loadRecipe(r).catch(()=>null)));
  const tips=acquisitionTips(clean,recipes.length>0);
  app.innerHTML=topbar(nameJa(clean),nameEn(clean),true)+
    '<main class="content"><div class="hero">'+slot(clean,"large",1,false)+'<div><h1>'+esc(nameJa(clean))+'</h1><div class="en">'+esc(nameEn(clean))+'</div><div class="item-id">minecraft:'+esc(clean)+'</div></div></div>'+
    (recipes.length?'<div class="section-title">クラフト・加工方法</div>'+recipes.map((r,i)=>
      '<button class="recipe-card" data-recipe="'+esc(r.recipeId)+'">'+slot(r.outputGuess,"small",1,false)+
      '<div class="item-main"><div class="item-ja">'+esc((details[i]&&details[i].methodName)||r.category)+'</div><div class="item-en">'+esc(r.recipeId)+'</div></div><div class="chev">›</div></button>'
    ).join(""):'<div class="notice">通常のクラフト・加工レシピはありません。</div>')+
    '<div class="section-title">'+(recipes.length?"その他の入手方法":"入手方法")+'</div>'+
    tips.map(t=>'<div class="tip"><b>•</b><div>'+esc(t)+'</div></div>').join("")+
    '<div class="footer-note">※ レシピ材料に複数候補がある場合は、代表的なアイテムを表示します。</div></main>';
  document.getElementById("backBtn").onclick=goBack;
  document.querySelectorAll("[data-recipe]").forEach(b=>{
    const s=summaries.find(x=>x.recipeId===b.dataset.recipe);
    b.onclick=()=>navigate({page:"recipe",recipeId:s.recipeId});
  });
}

function methodName(type){
  const m={crafting_shaped:"作業台（形あり）",crafting_shapeless:"作業台（形なし）",smelting:"かまど",blasting:"溶鉱炉",smoking:"燻製器",campfire_cooking:"焚き火",stonecutting:"石切台",smithing_transform:"鍛冶台",smithing_trim:"鍛冶台（装飾）",brewing:"醸造台"};
  return m[type]||(type.startsWith("crafting_special")?"特殊クラフト":pretty(type));
}
async function resolveTag(tagRaw,depth){
  const tag=cleanId(String(tagRaw).replace(/^#/,""));
  if(tagCache.has(tag))return tagCache.get(tag);
  if(depth>5)return[tag.replace(/s$/,"")];
  const urls=[
    ASSET_BASE+"/data/minecraft/tags/item/"+tag+".json",
    ASSET_BASE+"/data/minecraft/tags/block/"+tag+".json",
    FALLBACK_ASSET_BASE+"/data/minecraft/tags/item/"+tag+".json",
    FALLBACK_ASSET_BASE+"/data/minecraft/tags/block/"+tag+".json"
  ];
  let out=[];
  for(const url of urls){
    try{
      const o=await fetchJson(url),vals=o.values||[];
      for(const v0 of vals){
        const v=typeof v0==="string"?v0:(v0&&v0.id)||"";
        if(!v)continue;
        if(v.startsWith("#"))out.push(...await resolveTag(v.slice(1),depth+1));
        else out.push(cleanId(v));
        if(out.length>=16)break;
      }
      if(out.length)break;
    }catch(e){}
  }
  out=[...new Set(out)].filter(x=>hasAsset(x));
  if(!out.length)out=[tag.replace(/s$/,"")];
  tagCache.set(tag,out);return out;
}
async function parseIngredient(v,depth=0){
  if(v==null||depth>5)return null;
  if(typeof v==="string"){
    if(v.startsWith("#"))return{options:await resolveTag(v.slice(1),depth+1),sourceTag:v};
    return{options:[cleanId(v)],sourceTag:null};
  }
  if(Array.isArray(v)){
    let opts=[],tag=null;
    for(const x of v){const i=await parseIngredient(x,depth+1);if(i){opts.push(...i.options);tag=tag||i.sourceTag;}}
    return opts.length?{options:[...new Set(opts)],sourceTag:tag}:null;
  }
  if(typeof v==="object"){
    if(v.item)return parseIngredient(v.item,depth+1);
    if(v.items)return parseIngredient(v.items,depth+1);
    if(v.tag)return{options:await resolveTag(v.tag,depth+1),sourceTag:"#"+cleanId(v.tag)};
    if(v.id)return parseIngredient(v.id,depth+1);
  }
  return null;
}
function parseOutput(raw,fallback){
  const c=raw.result??raw.output;
  if(typeof c==="string")return{id:cleanId(c),count:1};
  if(c&&typeof c==="object")return{id:cleanId(c.id||c.item||fallback),count:Math.max(1,Number(c.count||1))};
  return{id:fallback,count:1};
}
async function loadRecipe(summary){
  if(recipeCache.has(summary.recipeId))return recipeCache.get(summary.recipeId);
  const raw=await fetchJsonFromBases("data/minecraft/recipe/"+summary.recipeId+".json");
  const type=String(raw.type||"").split(":").pop(),grid=Array(9).fill(null),processInputs=[];
  let note=null;
  if(type==="crafting_shaped"){
    const pat=raw.pattern||[],key=raw.key||{};
    for(let r=0;r<Math.min(3,pat.length);r++)for(let c=0;c<Math.min(3,pat[r].length);c++){const ch=pat[r][c];if(ch!==" ")grid[r*3+c]=await parseIngredient(key[ch]);}
  }else if(type==="crafting_shapeless"){
    for(let i=0;i<Math.min(9,(raw.ingredients||[]).length);i++)grid[i]=await parseIngredient(raw.ingredients[i]);
  }else if(type.startsWith("crafting_special")){
    note="特殊クラフトです。材料の組み合わせはゲーム内の特殊ルールで処理されます。";
  }else if(type==="smithing_transform"||type==="smithing_trim"){
    for(const k of["template","base","addition"]){const x=await parseIngredient(raw[k]);if(x)processInputs.push(x);}
    if(type==="smithing_trim")note="鍛冶型・防具・素材を使う装飾用の鍛冶レシピです。完成品は元の防具によって変わります。";
  }else{
    let x=await parseIngredient(raw.ingredient??raw.input);if(x)processInputs.push(x);
    if(!processInputs.length&&Array.isArray(raw.ingredients))for(const v of raw.ingredients){x=await parseIngredient(v);if(x)processInputs.push(x);}
  }
  const out=parseOutput(raw,summary.outputGuess);
  const parsed={recipeId:summary.recipeId,type,methodName:methodName(type),grid,processInputs,outputId:out.id,outputCount:out.count,note};
  recipeCache.set(summary.recipeId,parsed);return parsed;
}
function primary(ing){if(!ing)return null;return ing.options.find(x=>hasAsset(x))||ing.options[0]||null;}

async function renderRecipe(recipeId){
  const summary=summaries.find(s=>s.recipeId===recipeId);
  if(!summary){renderState({page:"home"});return;}
  app.innerHTML=topbar(summary.jaName,summary.enName,true)+'<main class="content"><div class="loading"><div class="spinner"></div>レシピを読み込み中…</div></main>';
  document.getElementById("backBtn").onclick=goBack;
  try{
    const r=await loadRecipe(summary),isCraft=r.type==="crafting_shaped"||r.type==="crafting_shapeless";
    const ingredients=(isCraft?r.grid.filter(Boolean):r.processInputs);
    const grouped=new Map();
    ingredients.forEach(i=>{const k=(i.sourceTag||"")+"|"+(primary(i)||"");if(!grouped.has(k))grouped.set(k,{ing:i,count:0});grouped.get(k).count++;});
    let panel="";
    if(isCraft){
      panel='<div class="panel"><div class="panel-title">クラフト</div><div class="craft-wrap"><div class="grid3">'+
      r.grid.map(i=>slot(primary(i),"",1,!!primary(i))).join("")+'</div><div class="arrow">➜</div>'+slot(r.outputId,"large",r.outputCount,false)+'</div></div>';
    }else{
      panel='<div class="panel"><div class="panel-title">'+esc(r.methodName)+'</div><div class="craft-wrap"><div>'+
      (r.processInputs.length?r.processInputs.slice(0,3).map(i=>slot(primary(i),"",1,!!primary(i))).join(""):slot(null,"",1,false))+
      '</div><div class="arrow">➜</div>'+slot(r.outputId,"large",r.outputCount,false)+'</div></div>';
    }
    app.innerHTML=topbar(nameJa(r.outputId),nameEn(r.outputId),true)+'<main class="content">'+
      '<div class="hero">'+slot(r.outputId,"large",r.outputCount,false)+'<div><h1>'+esc(nameJa(r.outputId))+'</h1><div class="en">'+esc(nameEn(r.outputId))+'</div><div class="badge" style="margin-top:6px;display:inline-block">'+esc(r.methodName)+'</div></div></div>'+
      panel+(r.note?'<div class="notice" style="margin-top:12px">'+esc(r.note)+'</div>':'')+
      (grouped.size?'<div class="section-title">必要なアイテム</div>'+[...grouped.values()].map(g=>{const id=primary(g.ing);return '<div class="ingredient-row" '+(id?'data-item-row="'+esc(id)+'"':'')+'>'+slot(id,"small",1,false)+'<div class="ingredient-text"><div class="ja">'+esc(nameJa(id||""))+'</div><div class="en">'+esc(nameEn(id||""))+'</div>'+(g.ing.sourceTag?'<div class="tag">選択可能: '+esc(g.ing.sourceTag)+'</div>':'')+'</div>'+(g.count>1?'<b>×'+g.count+'</b>':'')+'</div>';}).join(""):'')+
      '<div class="footer-note">レシピID: minecraft:'+esc(r.recipeId)+'<br>データ: Minecraft Java '+VERSION+'</div></main>';
    document.getElementById("backBtn").onclick=goBack;
    document.querySelectorAll("[data-item]").forEach(el=>el.onclick=()=>navigate({page:"item",itemId:el.dataset.item}));
    document.querySelectorAll("[data-item-row]").forEach(el=>el.onclick=()=>navigate({page:"item",itemId:el.dataset.itemRow}));
  }catch(e){
    app.innerHTML=topbar(summary.jaName,summary.enName,true)+'<main class="content"><div class="error">このレシピを読み込めませんでした。<br>'+esc(e.message)+'</div></main>';
    document.getElementById("backBtn").onclick=goBack;
  }
}

function renderState(state){
  if(!state||!state.page)state={page:"home"};
  if(state.page==="home")renderHome();
  else if(state.page==="item")renderItem(state.itemId);
  else if(state.page==="recipe")renderRecipe(state.recipeId);
}
async function init(){
  app.innerHTML=topbar("RecipeBook","Minecraft Java 26.3・非公式",false)+'<main class="content"><div class="loading"><div class="spinner"></div>データを読み込み中…</div></main>';
  try{
    const [stableJa,fallbackJa,stableEn,fallbackEn,stableIndex,fallbackIndex,tree]=await Promise.all([
      fetchJson(ASSET_BASE+"/assets/minecraft/lang/ja_jp.json").catch(()=>({})),
      fetchJson(FALLBACK_ASSET_BASE+"/assets/minecraft/lang/ja_jp.json").catch(()=>({})),
      fetchJson(ASSET_BASE+"/assets/minecraft/lang/en_us.json").catch(()=>({})),
      fetchJson(FALLBACK_ASSET_BASE+"/assets/minecraft/lang/en_us.json").catch(()=>({})),
      fetchJson(ASSET_BASE+"/data/minecraft/recipe/_list.json").catch(()=>({files:[]})),
      fetchJson(FALLBACK_ASSET_BASE+"/data/minecraft/recipe/_list.json").catch(()=>({files:[]})),
      fetchJson(ASSET_TREE_URL)
    ]);

    ja={...fallbackJa,...stableJa};
    en={...fallbackEn,...stableEn};
    assetSet=new Set(
      (tree.tree||[])
        .filter(x=>x.path&&x.path.startsWith("item-assets/")&&x.path.endsWith(".png"))
        .map(x=>x.path.split("/").pop().toUpperCase())
    );

    const recipeFiles=[...new Set([
      ...(Array.isArray(stableIndex.files)?stableIndex.files:[]),
      ...(Array.isArray(fallbackIndex.files)?fallbackIndex.files:[])
    ])];

    const recipeEntries=recipeFiles
      .filter(f=>String(f).endsWith(".json"))
      .map(f=>{
        const recipeId=String(f).replace(/\.json$/,"");
        const outputGuess=guessOutputId(recipeId);
        return{recipeId,outputGuess,jaName:nameJa(outputGuess),enName:nameEn(outputGuess),category:categoryOf(recipeId,outputGuess)};
      })
      .filter(s=>isDisplayable(s.outputGuess));

    const catalogEntries=[...assetSet]
      .map(name=>name.replace(/\.PNG$/i,"").toLowerCase())
      .filter(id=>isDisplayable(id))
      .map(id=>({
        recipeId:"__item__:"+id,
        outputGuess:id,
        jaName:nameJa(id),
        enName:nameEn(id),
        category:categoryOf("",id)
      }));

    summaries=[...recipeEntries,...catalogEntries];
    buildUniqueItems();
    history.replaceState({page:"home"},"","#home");
    renderHome();
    if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }catch(e){
    app.innerHTML=topbar("RecipeBook","Minecraft Java 26.3・非公式",false)+'<main class="content"><div class="error">データの取得に失敗しました。<br>'+esc(e.message)+'<br><br><button class="mc-btn" onclick="location.reload()">再読み込み</button></div></main>';
  }
}
init();

// RecipeBook Web deployed from public repository.
