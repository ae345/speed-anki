/* Starting setups. The app builds the day-by-day plan from these on its own. */
window.PRESETS=[{
  id:'2026-12-zen-ronpyo',
  version:2,
  title:'12月期末・全科目（論表重点）で始める',
  note:'12月2日からの期末テスト用。論理・表現は範囲と暗記カード139枚まで入っています。ほかの科目はおおまかな範囲なので、範囲表が出たら「計画の設定」で直してください。',
  decks:['ronpyo-points','ronpyo-a1','ronpyo-a2','ronpyo-b','ronpyo-cd'],
  settings:{
    examDate:'2026-12-02',weekdayMin:120,weekendMin:240,ankiMin:20,newLimit:40,
    holidays:['2026-11-23'],offDays:[],
    subjects:[
      {id:'ronpyo',name:'論理・表現',weight:3,cycles:3,testDate:'',items:[
        {id:'b374',label:'本冊 374〜402（比較の前半）：解説を読んで解き、×を付ける',min:60,decks:[]},
        {id:'b403',label:'本冊 403〜430（比較の後半）',min:50,decks:[]},
        {id:'b431',label:'本冊 431〜447（主語と動詞の一致）',min:35,decks:[]},
        {id:'b448',label:'本冊 448〜474（疑問文）',min:55,decks:[]},
        {id:'w11',label:'準拠問題集 第11章（比較）',min:40,decks:[]},
        {id:'w12',label:'準拠問題集 第12〜13章（一致・疑問文）',min:40,decks:[]},
        {id:'qa1',label:'予想問題A① 比較（4択）',min:15,decks:['ronpyo-a1']},
        {id:'qa2',label:'予想問題A② 一致・疑問文（4択）',min:15,decks:['ronpyo-a2']},
        {id:'qb',label:'予想問題B 並べ替え',min:10,decks:['ronpyo-b']},
        {id:'qcd',label:'予想問題C・D 書きかえ・誤り指摘',min:10,decks:['ronpyo-cd']}
      ]},
      {id:'eigo',name:'英語',weight:3,cycles:3,testDate:'',items:[
        {id:'tango',label:'範囲の単語',min:30,decks:[]},
        {id:'honbun1',label:'本文の内容確認と音読（前半）',min:40,decks:[]},
        {id:'honbun2',label:'本文の内容確認と音読（後半）',min:40,decks:[]},
        {id:'bunpo',label:'範囲の文法',min:40,decks:[]},
        {id:'keishiki',label:'前学期のテストと同じ形式の大問演習',min:40,decks:[]}
      ]},
      {id:'sugaku',name:'数学',weight:2,cycles:3,testDate:'',items:[
        {id:'rei1',label:'範囲の例題（前半）',min:50,decks:[]},
        {id:'rei2',label:'範囲の例題（後半）',min:50,decks:[]},
        {id:'hyojun',label:'範囲の標準問題',min:50,decks:[]}
      ]},
      {id:'kokugo',name:'国語',weight:2,cycles:3,testDate:'',items:[
        {id:'kobun1',label:'古文単語と古典文法',min:30,decks:[]},
        {id:'kobun2',label:'古文の本文の読み直し',min:40,decks:[]},
        {id:'kanbun',label:'漢文の句形と本文',min:40,decks:[]},
        {id:'gendai',label:'現代文の本文の読み直し',min:40,decks:[]}
      ]},
      {id:'rika',name:'理科',weight:1,cycles:2,testDate:'',items:[
        {id:'kihon',label:'重要用語と基本問題',min:40,decks:[]},
        {id:'oyo',label:'計算・応用問題',min:40,decks:[]}
      ]},
      {id:'shakai',name:'社会',weight:1,cycles:2,testDate:'',items:[
        {id:'nagare',label:'範囲の流れと用語の整理',min:50,decks:[]},
        {id:'ichimon',label:'一問一答で確認',min:30,decks:[]}
      ]},
      {id:'joho',name:'情報',weight:1,cycles:2,testDate:'',items:[
        {id:'kihon',label:'用語と基本問題',min:30,decks:[]}
      ]}
    ],
    /* 11/8 is a 論表-only day of about 2 hours */
    dayMin:{'2026-11-08':120},
    onlyDay:{'2026-11-08':'ronpyo'},
    extras:[
      {id:'d1108a',date:'2026-11-08',subject:'論理・表現',title:'文法ポイントのカードを最後まで回す（比較・一致・疑問文）',min:25,decks:['ronpyo-points']},
      {id:'d1108b',date:'2026-11-08',subject:'論理・表現',title:'比較の4択問題を最後まで回す（間違えたら解説を読む）',min:15,decks:['ronpyo-a1']},
      {id:'d1108c',date:'2026-11-08',subject:'論理・表現',title:'本冊 374〜402 で×を付けた問題を、答えを隠して解き直す',min:20,last:true}
    ]
  }
}];
