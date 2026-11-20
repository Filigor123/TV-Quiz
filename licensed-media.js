(() => {
  const audio=(id,text,answers,explanation,file)=>({id,text,answers,correct:0,explanation,
    source:'media-credits.html',media:{type:'audio',src:'assets/licensed/'+file,startSeconds:0,endSeconds:12,challengeSeconds:3}});
  window.QUIZ_LICENSED_AUDIO=[
    audio('licensed-a01','Какой щипковый инструмент задаёт характер этого фрагмента?',['Укулеле','Труба','Виолончель','Литавры'],'Carefree — Kevin MacLeod. Ведущий щипковый тембр — укулеле; состав инструментов указан автором.','a01.mp3'),
    audio('licensed-a02','Какой духовой инструмент ведёт мелодию?',['Флейта','Тромбон','Туба','Валторна'],'Monkeys Spinning Monkeys — Kevin MacLeod: флейты и струнные пиццикато.','a02.mp3')
  ];
  window.QUIZ_LICENSED_VIDEO=[
    {id:'licensed-v01',text:'Какое животное выходит из жилища в этой сцене?',answers:['Кролик','Медведь','Белка','Лиса'],correct:0,explanation:'Большой кролик — герой короткометражки Big Buck Bunny.',source:'media-credits.html',media:{type:'video',src:'assets/licensed/v01.mp4',startSeconds:0,endSeconds:12}},
    {id:'licensed-v02',text:'Какое фантастическое существо появляется рядом с героиней?',answers:['Дракон','Единорог','Кентавр','Грифон'],correct:0,explanation:'В трейлере Sintel героиня встречает маленького дракона.',source:'media-credits.html',media:{type:'video',src:'assets/licensed/v02.mp4',startSeconds:0,endSeconds:9}}
  ];
})();
