// Read-only payload. No save, close, recompose or export.
(function(doc, job, helpers) {
    var result={name:doc.name,path:File(doc.fullName).fsName,modified:doc.modified,
        version:app.version,facingPages:doc.documentPreferences.facingPages,
        pages:[],sections:[],oversetStories:[],links:[]};
    var i,j,p,t;
    for(i=0;i<doc.pages.length;i++) {
        p=doc.pages[i];var page={physical:i+1,label:p.name,side:String(p.side),
            spread:p.parent.index+1,items:p.allPageItems.length,frames:[]};
        for(j=0;j<p.textFrames.length;j++) {
            t=p.textFrames[j];page.frames.push({id:t.id,bounds:t.geometricBounds,
                text:t.contents,overflows:t.overflows});
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
