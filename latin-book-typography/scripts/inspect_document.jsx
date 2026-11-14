// Read-only payload. No save, close, recompose or export.
// Frame text is limited to a short preview so results never carry the whole manuscript.
(function(doc, job, helpers) {
    var PREVIEW=80;
    var result={name:doc.name,path:File(doc.fullName).fsName,modified:doc.modified,
        version:app.version,facingPages:doc.documentPreferences.facingPages,
        pages:[],sections:[],oversetStories:[],links:[]};
    var i,j,p,t,text;
    function frameId(f){ return (f && f.isValid) ? f.id : null; }
    for(i=0;i<doc.pages.length;i++) {
        p=doc.pages[i];var page={physical:i+1,label:p.name,side:String(p.side),
            spread:p.parent.index+1,items:p.allPageItems.length,frames:[]};
        for(j=0;j<p.textFrames.length;j++) {
            t=p.textFrames[j];text=String(t.contents);
            page.frames.push({id:t.id,storyId:t.parentStory.id,bounds:t.geometricBounds,
                previousFrame:frameId(t.previousTextFrame),nextFrame:frameId(t.nextTextFrame),
                length:text.length,preview:text.slice(0,PREVIEW),overflows:t.overflows});
        }
        result.pages.push(page);
    }
    for(i=0;i<doc.sections.length;i++) {
        var s=doc.sections[i];result.sections.push({physical:s.pageStart.documentOffset+1,
            start:s.pageNumberStart,continueNumbering:s.continueNumbering,
            style:String(s.pageNumberStyle),prefix:s.sectionPrefix});
    }
    for(i=0;i<doc.stories.length;i++) if(doc.stories[i].overflows) result.oversetStories.push(doc.stories[i].id);
    for(i=0;i<doc.links.length;i++) result.links.push({name:doc.links[i].name,status:String(doc.links[i].status)});
    return result;
})
