window.ReplicaData = {
  credits: 323946,
  project: {
    name: "离婚后（3集）",
    style: "真人写实电影风格高清",
    ratio: "9:16",
    sceneRatio: "16:9",
    version: "原剧本 / 国内",
    team: "非制作剧团队",
    space: "AI内部团队验证-重庆使用-测试项目A"
  },
  outline: {
    summary:
      "外卖员萧铭与贺芷结婚三年，默默帮贺家对接董家资源，却一直被贺家全员看不起。贺芷为了攀附苏家、拿下董家订单，执意要和萧铭离婚，还安排家人上门索要补偿。贺芷先在萧母坟前逼萧铭签离婚协议，后贺毅上门索要补偿时打翻萧母遗像，彻底激怒萧铭。萧铭折断贺毅的手，与赶来的贺芷彻底决裂，放话苏家拿不到董家订单，身后一排豪车驶来暗示其身份不凡。",
    genre: "逆袭；扮猪吃虎 / 上门女婿 / 打脸",
    tone: "走向先抑后扬。前两集萧铭被贺家全员羞辱、母亲遗像被打翻，情绪压抑到顶点；第3集萧铭出手折断贺毅的手、放话阻拦苏家拿下订单构成首次燃点。结局未完待续。",
    era: "当代都市。贺家攀附苏家、争夺董家订单，萧铭隐姓埋名以外卖员身份生活。",
    people: [
      { name: "萧铭", tag: "主角", desc: "贺家前女婿，隐姓埋名的商界大佬。隐忍重情，前期退让被羞辱，触碰到母亲底线后强势反击。" },
      { name: "贺芷", tag: "贺总", desc: "贺家掌权人，萧铭前妻。现实功利，为家族发展可以放弃三年婚姻。" },
      { name: "贺毅", desc: "贺芷弟弟。傲慢嚣张，上门索要补偿不成打翻萧母遗像。" },
      { name: "崔桂华", desc: "贺芷母亲。势利刻薄，一心攀附权贵，看不起做外卖员的萧铭。" },
      { name: "沈妍妍", desc: "贺芷助理。趋炎附势，多次出言羞辱萧铭。" }
    ],
    scripts: [
      {
        title: "第1集：墓地贺芷提离婚协议",
        body: "1-1 墓地 日 外  出场：萧铭、沈妍妍、贺芷\n萧铭穿着外卖服将电动车停在路边，取下白色头巾戴上，拿下一袋纸钱，蹲在母亲坟前：妈，对不起，今天来晚了。身后一辆豪车将电动车撞倒。沈妍妍跟着贺芷打伞下车，贺芷居高临下俯视萧铭，沈妍妍厌恶地说：我说怎么找不到人，原来在给一个死人上坟。"
      },
      {
        title: "第2集：贺家人上门索要补偿",
        body: "2-1 别墅 日 内  出场：萧铭、崔桂华、贺毅\n萧铭将收拾好的包放在脚边，坐在沙发上看结婚照，又到牌位前上了三炷香。门口怒吼：萧铭，给老子滚出来！贺毅和崔桂华闯进来索要千万补偿。"
      },
      {
        title: "第3集：萧铭断贺毅手放狠话",
        body: "3-1 别墅 日 内  出场：萧铭、贺毅、崔桂华、贺芷\n萧铭微微用力，贺毅惨叫。咔嚓一声手腕被折断。萧铭冷冷道：再对我妈不敬试试！贺芷推门进来呵斥，萧铭放话苏家拿不到董家订单，门外一排豪车驶来。"
      }
    ]
  },
  characters: [
    {
      id: "xiaoming", name: "萧铭", tag: "主角", looks: 2, desc: "隐姓埋名的商界大佬，前期隐忍退让",
      image: "media/characters/xiaoming.png", look: "外卖服戴头巾", voice: "沉稳低沉，语速偏慢，隐忍时压着怒气。",
      looksList: [
        { id: "home", name: "萧铭-居家常服", eps: "1,2,3", image: "media/characters/gushen.png", prompt: "30岁中国男性，短发，居家灰色T恤，深蓝牛仔裤，白底全身三视图，正面、侧面、背面。" },
        { id: "delivery", name: "萧铭-外卖服戴头巾", eps: "1", image: "media/characters/xiaoming.png", prompt: "30岁中国男性，短发，亮黄外卖外套，黑裤，手持白色头巾，白底全身三视图。" }
      ]
    },
    {
      id: "hezhi", name: "贺芷", looks: 2, desc: "贺家掌权人，为家族利益放弃婚姻",
      image: "media/characters/hezhi.png", look: "黑色女总裁装", voice: "清冷利落，带命令口吻。",
      looksList: [
        { id: "ceo", name: "贺芷-黑色女总裁装", eps: "1,2,3", image: "media/characters/hezhi.png", prompt: "28岁中国女性，黑色西装套装，手持黑伞，白底全身三视图。" },
        { id: "home2", name: "贺芷-日常便装", eps: "2,3", image: "media/characters/suwan.png", prompt: "28岁中国女性，深色连衣裙，白底全身三视图。" }
      ]
    },
    {
      id: "cuiguihua", name: "崔桂华", looks: 1, desc: "贺家主母，势利贪婪，看不起萧铭",
      image: "media/characters/cuiguihua.png", look: "黑色旗袍", voice: "尖细，爱抱怨。",
      looksList: [
        { id: "qipao", name: "崔桂华-黑色旗袍", eps: "2,3", image: "media/characters/cuiguihua.png", prompt: "50岁中国女性，黑色旗袍，白底全身三视图。" }
      ]
    },
    {
      id: "heyi", name: "贺毅", looks: 1, desc: "贺芷弟弟，纨绔子弟，欺软怕硬",
      image: "media/characters/heyi.png", look: "花衬衫", voice: "嚣张，语速快。",
      looksList: [
        { id: "shirt", name: "贺毅-花衬衫", eps: "2,3", image: "media/characters/heyi.png", prompt: "25岁中国男性，花衬衫，白底全身三视图。" }
      ]
    },
    {
      id: "shen", name: "沈妍妍", looks: 1, desc: "贺芷的助理，趋炎附势，多次羞辱萧铭",
      image: "media/characters/shen.png", look: "都市通勤装", voice: "轻蔑，爱接话。",
      looksList: [
        { id: "office", name: "沈妍妍-都市通勤装", eps: "1", image: "media/characters/shen.png", prompt: "26岁中国女性，都市通勤装，白底全身三视图。" }
      ]
    }
  ],
  scenes: [
    { id: "cemetery", name: "墓地", desc: "日 · 外", image: "media/scenes/cemetery.png" },
    { id: "villa", name: "别墅客厅", desc: "日 · 内", image: "media/scenes/office.png" },
    { id: "gate", name: "别墅门口", desc: "日 · 外", image: "media/scenes/rain.png" }
  ],
  props: [
    { id: "ebike", name: "萧铭的电动车", image: "media/props/ebike.png" },
    { id: "joss", name: "纸钱", image: "media/props/joss.png" },
    { id: "car", name: "贺芷的豪车", image: "media/props/car.png" }
  ],
  episodes: [
    { id: "ep1", no: 1, title: "第1集：墓地贺芷提离婚协议", roles: 3, scenes: 1, props: 6, shots: 19, status: "ready" },
    { id: "ep2", no: 2, title: "第2集：贺家人上门索要补偿", roles: 3, scenes: 1, props: 4, shots: 3, status: "ready" },
    { id: "ep3", no: 3, title: "第3集：萧铭断贺毅手放狠话", roles: 4, scenes: 2, props: 3, shots: 0, status: "parse" }
  ],
  dramaTypes: [
    { id: "short", name: "短剧", hint: "对白驱动，适合真人写实与电影质感" },
    { id: "comic", name: "漫剧", hint: "2D / 3D 动画画风，适合动态漫与条漫" },
    { id: "comment", name: "解说剧", hint: "旁白解说体；分集视频可使用一键成片" }
  ],
  styles: [
    { id: "live-ancient", name: "真人古风", map: "真人", desc: "真人演员质感，古代东方服饰与建筑", types: ["short", "comic", "comment"], cover: "sc-ancient" },
    { id: "cinematic", name: "影视质感", map: "真人", desc: "电影级光影、景深与叙事调色", types: ["short", "comic", "comment"], cover: "sc-cinema" },
    { id: "3d-modern", name: "3D现代", map: "3D", desc: "当代三维渲染，结构清楚、材质可信", types: ["short", "comic", "comment"], cover: "sc-3d-modern" },
    { id: "3d-ancient", name: "3D古风", map: "3D", desc: "仙侠 / 古代高精度 3D，玉石丝绸层次分明", types: ["short", "comic", "comment"], cover: "sc-3d-ancient" },
    { id: "live-hd", name: "真人写实电影风格高清", map: "真人", desc: "真实演员感，电影布光，可实拍服化道", types: ["short", "comic", "comment"], cover: "sc-live-hd" },
    { id: "comic", name: "漫剧风格", map: "2D", desc: "竖屏动态漫，线条清晰、色块分明", types: ["short", "comic", "comment"], cover: "sc-comic" },
    { id: "guofeng", name: "2D国风半厚涂", map: "2D", desc: "线稿加半厚涂，适合玄幻与国风动态漫", types: ["short", "comic", "comment"], cover: "sc-guofeng" },
    { id: "cg-anim", name: "3D CG动画高清渲染", map: "3D", desc: "动画电影精度，体积感与材质层次强", types: ["short", "comic", "comment"], cover: "sc-cg-anim" },
    { id: "cel", name: "2D赛璐璐平涂", map: "2D", desc: "干净线稿、硬边阴影，日系或国风平涂", types: ["short", "comic", "comment"], cover: "sc-cel" },
    { id: "halftone", name: "2D卡通网点纸", map: "2D", desc: "复古印刷网点，适合喜剧和风格化叙事", types: ["short", "comic", "comment"], cover: "sc-halftone" },
    { id: "live-cold", name: "真人写实电影风格冷色调", map: "真人", desc: "青蓝灰冷色电影风，适合悬疑都市", types: ["short", "comic", "comment"], cover: "sc-live-cold" },
    { id: "am-real", name: "美漫写实风格", map: "2D", desc: "美漫厚涂、强明暗与霓虹粗粝美学", types: ["short", "comic", "comment"], cover: "sc-am-real" },
    { id: "cg-film", name: "3D CG风格", map: "3D", desc: "超写实电影级三维，光线追踪与金属反射", types: ["short", "comic", "comment"], cover: "sc-cg-film" },
    { id: "korean", name: "韩漫插画", map: "2D", desc: "精致韩漫插画，五官与服饰细节清楚", types: ["short", "comic", "comment"], cover: "sc-korean" },
    { id: "oil", name: "油画风格", map: "2D", desc: "厚涂油画肌理，史诗明暗与西方奇幻倾向", types: ["short", "comic", "comment"], cover: "sc-oil" },
    { id: "korean-us", name: "美式韩漫风格", map: "2D", desc: "韩漫插画加二次元电影感，色彩通透", types: ["short", "comic", "comment"], cover: "sc-korean-us" },
    { id: "cartoon-3d", name: "3D卡通风格", map: "3D", desc: "圆润卡通、少儿向、高饱和、清晰轮廓", types: ["short", "comic", "comment"], cover: "sc-cartoon", badge: "NEW" }
  ],
  models: [
    { id: "seedance-2.0", name: "Seedance 2.0", cost: 150 },
    { id: "seedance-2.5", name: "Seedance 2.5", tag: "推荐", cost: 180 },
    { id: "seedance-2.5-pro", name: "Seedance 2.5 超能版", tag: "超能", cost: 220 },
    { id: "wan-3", name: "Wan 3.0", cost: 160 }
  ],
  shots: [
    { id: "s1", no: 1, duration: 10, scene: "1-1 墓地 日 外", title: "萧铭来到坟前", refs: ["xiaoming", "cemetery", "ebike", "joss"] },
    { id: "s2", no: 2, duration: 4, scene: "1-1 墓地 日 外", title: "沈妍妍下车", refs: ["shen", "hezhi", "car"] },
    { id: "s3", no: 3, duration: 13, scene: "1-1 墓地 日 外", title: "萧铭烧纸", refs: ["xiaoming", "cemetery", "joss"] },
    { id: "s4", no: 4, duration: 14, scene: "1-1 墓地 日 外", title: "豪车撞倒电动车", refs: ["car", "ebike", "cemetery"] },
    { id: "s5", no: 5, duration: 10, scene: "1-1 墓地 日 外", title: "贺芷俯视", refs: ["hezhi", "xiaoming"] },
    { id: "s6", no: 6, duration: 15, scene: "1-1 墓地 日 外", title: "递离婚协议", refs: ["hezhi", "xiaoming"] }
  ],
  prompt:
    "【全局设定】画面风格和类型：真人写实电影风格高清，全程人物独立、自然表演，人物动作流畅、不穿透；全程禁止出现字幕、禁止角色变脸、卡顿、形象突变；杜绝肢体畸形、扭曲、残缺等人体结构错误；禁止出现闪烁、跳动、卡顿、顿帧等；全程无背景音乐、无BGM，只保留对白与环境声；主体置于安全区，避免头脚被切。\n\n【空间总结】墓地：场景左-左侧石阶与灰色墓碑；场景中-中央青石板步道及黑色花岗岩墓碑；场景右-石质矮墙与高大松柏；场景后-远山墓碑群；母景点-中央青石板步道、黑色花岗岩墓碑。\n\n【站位总结】萧铭-外卖服戴头巾 骑萧铭的电动车 停于中央青石板步道近端，面向黑色花岗岩墓碑；萧铭从车上取下白色头巾戴上，拿下一袋纸钱。\n\n【安全区/音轨】主体置于安全区，避免头脚被切；环境风声与脚步声。\n\nc001, 3.2s, 空间:中央青石板步道（姿态-萧铭-外卖服戴头巾-跨坐萧铭的电动车 面向墓碑，侧脸，侧面微俯）\nc002, 3.4s, 空间:黑色花岗岩墓碑前（姿态-萧铭-外卖服戴头巾-蹲在墓前 双手捧纸钱，神色哀伤）"
};

window.ReplicaUI = {
  toast: function (msg) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
  },
  credits: function () {
    return ReplicaData.credits.toLocaleString("en-US");
  }
};
