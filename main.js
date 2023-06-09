const apiKey=''
const PER_PAGE = 12
const anchor = document.getElementById('main')
const searchForm = document.querySelector('.navbar form')
const currentPage = () => document.getElementById('main').lastElementChild
const filterUndefined = obj =>Object.keys(obj).reduce((n, i) => {
  if (obj[i] !== undefined) n[i] = obj[i]
  return n
}, {})
const notInMetadata = obj => ['authors','title','subtitle','publisher','pageCount','imageLinks','industryIdentifiers','isbn','teaser','description','thumbnail','image'].filter(att => !obj[att] || (typeof obj[att] === 'object' && !Object.keys(obj[att]).length))
const cats = ["Antiquit&auml;ten & Sammlerst&uuml;cke","Architektur","Belletristik","Bibel","Bildung","Biographie & Autobiographie","Business & Wirtschaft","Comics & Graphic Novels","Computer","Darstellende K&uuml;nste","Design","Drama","Familie & Beziehungen","Fremdsprachenstudium","Garten","Geschichte","Gesundheit & Fitness","Handwerk & Hobby","Haus & Heim","Haustiere","Humor","Jugendliteratur","Kinderb&uuml;cher","Kochen","Kunst","K&ouml;rper, Geist und Seele","Literaturkritik","Literatursammlungen","Lyrik","Mathematik","Medizin","Musik","Nachschlagewerke","Natur","Naturwissenschaften","Philosophie","Photographie","Politikwissenschaft","Psychologie","Recht","Reisen","Religion","Sachbucher f&uuml;r Kinder","Sachb&uuml;cher f&uuml;r junge Erwachsene","Selbsthilfe","Sozialwissenschaften","Spiel & Freizeit","Sport & Freizeit","Sprachwissenschaften","Studium","Technik & Ingenieurwesen","True Crime","Verkehr"]

/* Little helpers */
const _ = el => currentPage().querySelector(el)
const __ = el => currentPage().querySelectorAll(el)
const div = html => {
  const d = document.createElement('div')
  if(typeof html === 'string') d.insertAdjacentHTML('afterbegin',html)
  else d.appendChild(html)
  return d
}
const chooseColor = () => {
  let prevColor,color
  return () => {
    color = ['color-blue','color-green','color-orange','color-brown'][Math.floor(4*Math.random())]
    while (color === prevColor) {
      color = ['color-blue','color-green','color-orange','color-brown'][Math.floor(4*Math.random())]
    }
    prevColor = color
    return color
  }
}
const getColor = chooseColor()

class Observer {
  
  constructor(){
    this.watchers = []
    this.watchersOnce = []
    this.current = [undefined,undefined]
    this.register = this.register.bind(this)
    this.notify = this.notify.bind(this)
  }
  
  register(callback,once) {
    if (once) {
      this.watchersOnce.push(callback)
      return
    }
    this.watchers.push(callback)
    const [ov,nv] = this.current
    if (nv) callback(nv,ov)
  }
  
  notify(nv) {
    this.current.shift()
    this.current.push(nv)
    let ov
    [ov,nv] = this.current
    this.watchers.forEach(callback => callback(nv,ov))
    this.watchersOnce.forEach(callback => callback(nv,ov))
    this.watchersOnce = []
  }
}

class SearchResultPager{
  static createFrom(opts) {
    const srp = new SearchResultPager()
    srp._search = opts.search;
    srp._mapItem = opts.mapItem ?? function(x){return x};
    srp._maxResults = opts.maxResults??PER_PAGE
    return srp
  }
  
  
  get searchResultItems() {
    return this._result
  }
  
  constructor(){
    this._onSearchResultItems = new Observer('neue Suchergebnisse')
  }
  
  get onSearchResult() {
    return this._onSearchResultItems
  }
  
  set onSearchResult(callback) {
    this._onSearchResultItems.register(callback)
  }
  
  search = async (term,pageCount,maxResults) => {
    this._pageCount = pageCount ?? 0
    this._term = term
    return this._search(term, this._pageCount,maxResults ?? this._maxResults )
    .then(({numberOfItems,result}) => {
      result = result.map(this._mapItem)
      this._numberOfItems = numberOfItems
      if (this._pageCount == 0) this._result = result
      else result.forEach(item => this._result.push(item))
      this.onSearchResult.notify(result)
      return {
        numberOfItems,
        result
      }
    })
  } 
  
  fetchNextSearchResult = async () => {
    this._pageCount += 1;
    if (this._maxResults*this._pageCount > this._numberOfItems) return 
    const nextResults = await this.search(this._term, this._pageCount)
    return nextResults
  }

}

class GoogleBooksPager extends SearchResultPager {
  _maxResults = 10
  constructor(){super()}
  searchURL = (term,pageCount,maxResults) => {
    const url = "https://www.googleapis.com/books/v1/volumes"
    const q = { q: term }
    pageCount && (q.startIndex = pageCount * this._maxResults)
    maxResults && (q.maxResults = maxResults)
    const qs = new URLSearchParams(q)
    return `${url}?${qs}`
  }
  
  _search = async (term, pageCount, maxResults) => {
    //return fetch(this.searchURL(term,pageCount,maxResults)).then(r => r.json())
    return (new Promise(resolve => setTimeout(() => resolve(googleSearchResult),500)))
    .then(({items,totalItems}) => {
      return {numberOfItems: totalItems,result:items}
    })
  }
  
  _mapItem = ( {id, volumeInfo, searchInfo} ) => {
			/* 
				Das Google Suchergebnis bedarf einer Anreicherung und Filterung
			 */
			const {authors,title, subtitle,industryIdentifiers,publisher,imageLinks,pageCount, description,categories} = volumeInfo
			const isbn = volumeInfo.industryIdentifiers?.find( identifier => identifier.type === "ISBN_13" || identifier.type === "ISBN_10")?.identifier??''
			const metaData = {
				imageLinks,authors,industryIdentifiers,publisher,pageCount,categories,description,title,subtitle,isbn,
				thumbnail: `http://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`,
				image: `https://portal.dnb.de/opac/mvb/cover?isbn=${isbn}`,
				categories: categories?.map( cat => translateCategory( cat ) ) ?? [],
				teaser:searchInfo?.textSnippet
			};
			
			return filterUndefined(metaData)
		}
  
}

class BookManager {
  
  get selectedBook(){
    return this._selectedBook
  }
  
  get searchResultPager() {
    return this._searchResultPager
  }
  
  set onFetchRandomSample(callback) {
    this._observerRandomSample.register(callback)
  }
  
  set onFetchRandomSampleOnce(callback) {
    this._observerRandomSample.register(callback,'once')
  }
 /*
  constructor(apiKey){
    this.app = new Realm.App({ id: 'boox-urcjb' })
    this._observerRandomSample = new Observer()
    this.loginApiKey(apiKey)
    .then(usr => {
      this.user = usr;
      console.log("Successfully logged in!", usr);
    }).then(this.init) 
  }
/*/
  constructor() {
    const wait = 500
    this._observerRandomSample = new Observer()
  	this.user = {functions:{
  	  randomSample: async _ => {
      await new Promise(x => setTimeout(x,wait))
 	    return {items: sample_raw.map(cat => {return {
  		    _id:[cat.category],
  		    boox:cat.boox.map(bk => {
      			const x = bk._id.toHexString
      			bk._id.toHexString = _ => x
      			return bk
    		  })
      	}})
  	  }},
      addBook: async () => {
        await new Promise(x => setTimeout(x,wait))
  	    return book.bookId
  	  },
    	updateBook: async () => {
        await new Promise(x => setTimeout(x,wait))
  	    return book
  	  },
    	getBook: async _ => {
        await new Promise(x => setTimeout(x,wait))
  	    return book
  	  },
    	search: async t => {
      await new Promise(x => setTimeout(x,wait))
   	  return {numberOfItems: search_data.numberOfItems,result:search_data.result.map(bk=>{
    	  return {
    	    path:bk.path,
    	    title:bk.title,
    	    subtitle:bk.subtitle,
    	    teaser:bk.teaser,
    	    authors:bk.authors,
    	    imageLinks:bk.imageLinks,
    	    _id: {toHexString: ()=> Math.floor(1000000 * Math.random())}
    	  }
    	  
    	})}}
    }}
    this.init()
  }
  
  init = () => {
    this.fetchRandomSample()
    this._searchResultPager =  SearchResultPager.createFrom({search: this.user.functions.search,mapItem: this.mapSearchResultItem})
    this.search = this._searchResultPager.search
    this.fetchNextSearchResult = this._searchResultPager.fetchNextSearchResult
  }
  
  mapSearchResultItem = ({_id,title,subtitle,teaser,authors,imageLinks,path}) => {
    return {
      bookId:_id.toHexString(),
      title,subtitle,teaser,authors,imageLinks,path
    }
  }

  fetchRandomSample = async () => {
    this.user.functions.randomSample().then(r => {
      this.randomSample = r.items.map(cat => { return {
        category: cat._id,
        books: cat.boox.map(({_id,title,authors,imageLinks}) => { return {
          bookId:_id.toHexString(),
          title,authors,imageLinks
        }})
      }})
    }).then(() => this._observerRandomSample.notify(this.randomSample))
  }
  
  fetchBook = async bookId => this.user.functions.getBook(bookId)
  .then( bk => {
    if (typeof bk['Sachgruppe(n)'] === "string" ) bk['Sachgruppe(n)'] = bk['Sachgruppe(n)'].split(/\s*;\s*/)
    if (typeof bk['Sprache(n)'] === "string" ) bk['Sprache(n)'] = bk['Sprache(n)'].split(/\s*;\s*/)
    if (typeof bk['Schlagwörter'] === "string" ) bk['Schlagwörter'] = bk['Schlagwörter'].split(/\s*;\s*/)
    if (typeof bk === "string" ) bk['Sprache(n)'] = bk['Sprache(n)'].split(', ')
    this._selectedBook = bk
    return bk
  })

  updateBook = async (bookId,book) => this.user.functions.updateBook(bookId,book)
    
  addBook = async (book) => this.user.functions.addBook(book)

  async loginApiKey(apiKey) {
    // Create an API Key credential
    const credentials = Realm.Credentials.apiKey(apiKey);
      try {
        // Authenticate the user
        const user = await this.app.logIn(credentials);
        // `App.currentUser` updates to match the logged in user
        console.assert(user.id === this.app.currentUser.id);
        return user;
    } catch (err) {
      console.error("Failed to log in", err);
    }
  }
  
}

const bookManager = new BookManager(apiKey)

const goto = async (pg,transition,...params) => { 
  /* 
    Hängt den view "pg" mit dem Übergrang "transition" und den Paramtern "params"
    am Aufhängepunkt "anchor" ein
   */
  let leaveMethod,enterMethod,beforeTransition,viewCreated,afterTransition;
  if (typeof transition === 'object') {
    ({transition,leaveMethod,enterMethod,beforeTransition,viewCreated,afterTransition} = transition)
  }
  if (typeof beforeTransition === 'function') await beforeTransition()
  let page
  const prevPage = anchor.lastElementChild
  if (typeof enterMethod === 'function') {
    page = await enterMethod()
  } else {
    const tpl = await pg(...params) 
    page = div(tpl)
    anchor.appendChild(page)
  }
  if (typeof viewCreated === 'function') await viewCreated()
  page.classList.add(transition+"-enter-start")
  prevPage.classList.add(transition+"-leave-start")
  await nextFrame()
  page.classList.replace(transition+"-enter-start",transition+"-enter-end")
  prevPage.classList.replace(transition+"-leave-start",transition+"-leave-end")
  await new Promise ( resolve => anchor.addEventListener('transitionend',()=>{
      page.classList.remove(transition+'-enter-end')
      prevPage.classList.remove(transition+'-leave-end')
      if (typeof leaveMethod === 'function') leaveMethod(prevPage)
      else prevPage.remove()
      resolve()
    },{once:true} ))
  if (typeof afterTransition === 'function') await afterTransition()
}

/* Seitenübergänge */
const details2detailsTransition = transition => {
  return {
    transition,
    afterTransition: () => {
      /* 
        Füge den Buttons die fehlenden Event
        Listener hinzu. Der back button führt
        zurück zur vorherigen Ansicht. Der 
        previous/next button soll zum 
        vorherigen/nächsten Element in der
        Liste führen, aus der heraus die 
        Einzelansicht erzeugt wurde. Dazu 
        benötigt die Einzelansicht einen 
        Verweis zur Liste. Diese ist entweder
        eine Kategorie aus der Galerie Ansicht
        oder die Liste einer Listenansicht
       */
      const listNode = currentPage().previousElementSibling
      const catIndex = Number(_(':first-child').dataset.catIndex)
      const bookIndex = Number(_(':first-child').dataset.bookIndex)
      const list = !isNaN(catIndex) ?bookManager.randomSample[catIndex].books : listNode.searchResultPager.searchResultItems
      const next = list[bookIndex+1]
      const previous = list[bookIndex-1]
      console.log(next,previous,list,catIndex,bookIndex)
      if(previous) _('#back').parentNode.insertAdjacentHTML('afterend',  previous.bookId ? `<div class="buttons v-centered ease-enter-end"><boox-button onclick="goto(detailsView,details2detailsTransition('slide-right'),'${previous.bookId}','${bookIndex-1}','${catIndex}','${previous.imageLinks?.thumbnail}')"  icon="arrow_back_ios"></boox-button></div>` : '')
      if(next) _('#back').parentNode.insertAdjacentHTML('afterend',  next.bookId ? `<div class="buttons v-centered right ease-enter-end"><boox-button onclick="goto(detailsView,details2detailsTransition('slide-left'),'${next.bookId}','${bookIndex+1}','${catIndex}','${next.imageLinks?.thumbnail}')" icon="arrow_forward_ios"></boox-button></div>` : '')
      currentPage().style.setProperty('background-color','var(--brown)')
      _('#back').addEventListener('click',function() {
        this.setAttribute('loading','')
        formWatcher.disconnect()
        goto('',backTransition('flyaway')).then(() => {
          this.removeAttribute('loading')
        })
      })
    }
  } 
}
const list2detailsTransition = transition => {
  return {
    leaveMethod: prevPage => prevPage.style.setProperty('display','none'),
    ...details2detailsTransition(transition)
  }   
}  
const homeTransition = transition => {
  /* zur Galerie Ansicht */
  return {
    transition,
    afterTransition: () => {
      currentPage().searchResultItems = bookManager.randomSample
      __('div.slider > div:last-of-type').forEach(el => el.addEventListener('click', function({ target }) {
        const icon = this.firstElementChild
        icon.remove()
        this.classList.add('loading')
        goto(categoriesView,categoriesTransition('zoom'),this.dataset.category).then(() => {
          this.classList.remove('loading')
          this.append(icon)
        })
    }))
  }}
}
const categoriesTransition = transition => {
  /* zur liste einer Kategorie */
  return {
    transition,
    leaveMethod: prevPage => prevPage.style.setProperty('display','none'),
    afterTransition: () => {
      currentPage().searchResultPager = searchProvider.searchResultPager
      currentPage().style.setProperty('background-color','white')
      const moreButton = _('.more-button')
      currentPage().endOfListWatcher = createEndOfListWatcher(moreButton)
    }
  }
}
const searchListTransition = transition => {
  /* zu den Suchergebnissen */
  return {
    transition,
    leaveMethod: prevPage => prevPage.style.setProperty('display','none'),
    afterTransition: () => {
      currentPage().searchResultPager = searchProvider.searchResultPager
      currentPage().style.setProperty('background-color','white')
      const moreButton = _('.more-button')
      currentPage().endOfListWatcher = createEndOfListWatcher(moreButton)
    }
  }
}
const addBookTransition = (transition) => {
  return {
    transition,
    beforeTransition: () => document.querySelector('.navbar').classList.add('navbar-invisible'),

    leaveMethod: prevPage => prevPage.style.setProperty('display','none'),
    viewCreated: () => currentPage().style.setProperty('background-color','lightyellow'),
    afterTransition: () => {
      const uploadButton = _('.upload')
      uploadButton.addEventListener('change',() => {
        document.querySelector('.navbar').classList.remove('navbar-invisible')
        document.querySelector('.navbar input').focus()
        document.querySelector('.navbar input').value = _('input').files[0].name
        bookManager.bookFile = _('input').files[0]
        _('boox-form').toggleGoogleSearch()
      })
    }
  }
}

const editSelectedBookTransition = (bookIndex) => {
  /* aus der suchliste zurück in das Formular */
  return {
    transition: 'flyaway',
    enterMethod: () => new Promise ( resolve => {
      const page = anchor.lastElementChild.previousElementSibling
      page.style.removeProperty('display')
      const form = BooxForm.prototype.isPrototypeOf(page) ? page : page.querySelector('boox-form')
      form.init(selectedBook)
      form.prepareTags(selectedBook)
      form.prepareListObjectInput(selectedBook)
      form.showButtons()
      form.showEditButtons()
      form.enableSaveButton()
      resolve(page)
    }),
    beforeTransition: () => {
      selectedBook =  currentPage().searchResultPager.searchResultItems[bookIndex]
      currentPage().endOfListWatcher?.disconnect()
    }
  }
}
const backTransition = transition => {
  /* zurück zur vorherigen Ansicht */
  return {
    transition,
    enterMethod: () => new Promise ( resolve => {
      const page = anchor.lastElementChild.previousElementSibling
      page.style.removeProperty('display')
      //anchor.append(page)
      resolve(page)
    }),
    beforeTransition: () => {
      currentPage().endOfListWatcher?.disconnect()
      if(! _('.nots')) { // kennzeichnet die Suchliste
        searchForm.lastElementChild.setAttribute('icon', 'search')
        searchForm.setAttribute('action', "javascript:goto(searchResultsView,searchListTransition('zoom'))")
        searchProvider = defaultSearchProvider
      }  
    }
  }
}
const googleSearchTransition = transition => {
  /* zu den Google Suchergebnissen */
  return {
    transition,
    beforeTransition: searchGoogle,
    afterTransition: () => {
      currentPage().style.setProperty('background-color','lightyellow')
      currentPage().searchResultPager = searchProvider.searchResultPager
      const moreButton = _('.more-button')
      endOfListWatcher = createEndOfListWatcher(moreButton)
    },
    leaveMethod: prevPage => prevPage.style.setProperty('display','none')
  }
}

/* Views und View Components*/
const homeView = async () =>  new Promise(resolve => {
  bookManager.onFetchRandomSample = randomSample => {
      let html = `<div class="buttons right bottom"><boox-button onclick="refreshSample()" icon="refresh"></boox-button></div>`
      html += randomSample.map( (cat,catIndex) => {
      let category = `<div data-cat-index="${catIndex}"><h1>${cat.category}</h1><div class="slider">`
      category+=cat.books.map( (bk,bookIndex) => bk.imageLinks?.thumbnail ? `<a data-cat-index="${catIndex}" data-book-index="${bookIndex}" href="javascript:goto(detailsView,list2detailsTransition('enlarge'),'${bk.bookId}','${bookIndex}','${catIndex}','${bk.imageLinks?.thumbnail}')"><img width="128px" src="${bk.imageLinks?.thumbnail}"></a>` : `<a href="javascript:goto(detailsView,list2detailsTransition('enlarge'),'${bk.bookId}','${bookIndex}','${catIndex}')"><div class="card-content"><p class="header">${bk.title}</p><p class="authors">${bk.authors}</p></div></a>`).join('')
    category+=`<div class="card-content" data-category="${cat.category}"><p class="more-horizontal">mehr in dieser Kategorie </p></div>`
    category+="</div></div>"
    return category
    }).join('')
    resolve(html)
  }
})
const listViewComponent = books => books.map( (book,bookIndex) => `<div class="card-entry">
  <div>
    <a href="javascript:goto(detailsView,list2detailsTransition('enlarge'),'${book.bookId}','${bookIndex}', ${undefined},'${book.imageLinks?.thumbnail}')">
    <img src="${book.imageLinks?.thumbnail}">
    </a>
    <p class="download"><a href="${book.path}">download</a></p>
  </div>
  <div>
    <p class="title ${getColor()}">${book.title} </p>
    <p class="subtitle">${book.subtitle} </p>
    <p class="authors">${book.authors} </p>
    <p class="teaser">${book.teaser??book.description??''}</p>
  </div>
</div>
`).join('')

const listView = (noi,title,str) => `<div class="buttons"><boox-button onclick="goto('',backTransition('flyaway'))" icon="west"></boox-button></div><div class="buttons right bottom"><boox-button icon="add" onclick="goto(addBookView,addBookTransition('slide'))"></boox-button></div><div style="text-align:center"><h2 class="${getColor()}">${title}</h2><p style="font-size:small">${noi} Ergebnisse gefunden</p></div>${str}<div class="more-button"></div>`

const googleListViewComponent = books => books.map( (book,index) => `<div class="card-entry">
  <div>
    <a href="javascript:gotoSelect('enlarge','${index}'">
    <img src="${book.imageLinks?.thumbnail}">
    </a>
  </div>
  <div>
    <p class="title ${getColor()}">${book.title} </p>
    <p class="subtitle">${book.subtitle??''} </p>
    <p class="authors">${book.authors} </p>
    <p class="teaser">${book.teaser??book.description??''}</p>
  </div>
</div>
<div class="nots">${evaluateResultViewComponent(book,index)}</div>
`).join('')

const categoriesView = async cat => {
  const r = await bookManager.search(cat)
  return searchProvider.listView(r.numberOfItems,cat,searchProvider.listViewComponent(r.result))
}

const searchResultsView = async () => {
  const term = document.querySelector('.navbar input').value
  const button = document.querySelector('.navbar boox-button')
  button.setAttribute('loading','')
  const r = await searchProvider.search(term)
  button.removeAttribute('loading')
  if (searchProvider.reset) document.querySelector('.navbar input').value = ""
  return searchProvider.listView(r.numberOfItems,term,searchProvider.listViewComponent(r.result))
}
const addBookView = () => `<div class="buttons"><boox-button onclick="goto('',backTransition('flyaway'))" icon="west"></boox-button></div><label class="upload">
    <input name="upload" type="file">
    <div>
      <span class="icon">upload_file</span>
      <span>E-Book auswählen</span>
    </div>
  </label>
  <boox-form></boox-form>
`
const evaluateResultViewComponent = (book,bookIndex) => {
  const missingData = notInMetadata(book)
  if (missingData.some(att => ['authors','title','categories','description','publisher','imageLinks','isbn'].includes(att)))
    return `<p class="warning" onclick="goto(undefined, editSelectedBookTransition(${bookIndex}))">Es fehlen ${notInMetadata(book).join(', ')}`
  else
    return `<p class="success" onclick="goto(undefined, editSelectedBookTransition(${bookIndex}))">Alle erforderlichen Attribute vorhanden`
}

/* die details Ansicht... */
const detailsViewComponent = book => `<div class="panel"><p class="title">${book.title}</p><p class="subtitle">${book.subtitle}</p><p class="authors">${book.authors}</p><p class="description">${book.description}</p><div></div><p class="download"><a href="${book.path}">herunterladen</a></p></div>`

const detailsFormDNBView = (book = selectedBook) => `<label>Art des Inhalts</label><input name="Art des Inhalts" class="entry" value="${book['Art des Inhalts']}" >
<label>EAN</label><input name="EAN" class="entry" value="${book['EAN']}" >
<label>Literarische Gattung</label><input name="Literarische Gattung" class="entry" value="${book['Literarische Gattung']}" >
<label>Organisation(en)</label><input name="Organisation(en)" class="entry" value="${book['Organisation(en)']}" >
<label>Person(en)</label><div class="tag"><div><input name="Person(en)" class="entry" value="${book['Person(en)']}" ><span class="icon disabled">check</span></div><div class="tags"></div></div>
<label>Sachgruppe(n)</label><div class="tag"><div><input name="Sachgruppe(n)" class="entry" value="${book['Sachgruppe(n)']}" ><span class="icon invisible">check</span></div><div class="tags"></div></div>
<label>Schlagwörter</label><div class="tag"><div><input name="Schlagwörter" class="entry" value="${book['Schlagwörter']}" ><span class="icon invisible">check</span></div><div class="tags"></div></div>
<label>Sprache(n)</label><div class="tag"><div><input name="Sprache(n)" class="entry" value="${book['Sprache(n)']}" ><span class="icon invisible">check</span></div><div class="tags"></div></div>
<label>Titel</label><input name="Titel" class="entry" value="${book['Titel']}" >
<label>Verlag</label><input name="Verlag" class="entry" value="${book['Verlag']}" >
<label>Zeitliche Einordnung</label><input name="Zeitliche Einordnung" class="entry" value="${book['Zeitliche Einordnung']}" >
<label>Zielgruppe</label><input name="Zielgruppe" class="entry" value="${book['Zielgruppe']}" >
<fieldset class="info group" name="creators"><legend>Autoren aus ePub</legend>${insertObject(book['creators'])}
</fieldset>
<fieldset class="info group" name="identifiers"><legend>Identifiers aus ePub</legend>${insertObject(book['identifiers'])}
</fieldset>
<fieldset class="info group" name="titles"><legend>Titel aus ePub</legend>${insertObject(book['titles'])}
</fieldset>
</fieldset>`

const detailsView = async (bookId,bookIndex,catIndex,thumbnail) => {
  const insertTab = html => {
    if (typeof html === 'string') _('div.card-content.tabs').insertAdjacentHTML('beforeend',html)
    else _('div.card-content.tabs').append(html)
  }
  bookManager.fetchBook(bookId)
  .then(book => {
    const relatedSearchTerm = book.authors
    const booxForm = new BooxForm(book)
    const formTab = div(booxForm)
    insertTab(detailsViewComponent(book))
    insertTab(booxForm)
    insertTab('<div id="related" class="column"></div>')
    bookManager.search(relatedSearchTerm).then(bx => {
      currentPage().searchResultPager = bookManager.searchResultPager
      _('#related').insertAdjacentHTML('afterbegin',listViewComponent(bx.result))
    })
    formWatcher = createFormObserver(booxForm)
    const img = new Image()
    img.src = book.image
    img.addEventListener('load',() => _('div.card-image > img').replaceWith(img))
  })
  return `<div class="card" onscroll="onScrollCard()" data-cat-index="${catIndex}" data-book-index="${bookIndex}">        
  <div class="card-image visible">
      <img src="${thumbnail}">
  </div>
  <div class="spacer">
      <h1 class="invisible">Metadaten</h1>
      <div class="white">
          <span onclick="scrollToTab(0)" class="active-tab">Übersicht</span>
          <span onclick="scrollToTab(1)">Bearbeiten</span>
          <span onclick="scrollToTab(2)">Ähnliches</span>
      </div>
  </div>
  <div class="card-content tabs">

  </div>
  
  <div class="buttons"><boox-button id="back" icon="north"></boox-button></div>
</div>
`
} 

/* helpers */
function refreshSample () {
  bookManager.fetchRandomSample()
  .then(()=>goto(homeView,homeTransition('zoom')))
  _('boox-button[icon=refresh]').setAttribute('loading','')
}

function nextFrame() {
	let count = 5
	return new Promise(resolve => {
		const step = () => {
			count-=1
			if(count) requestAnimationFrame(step)
			else requestAnimationFrame(resolve)
		}
		requestAnimationFrame(step);
	});
}

const setBoundingBox = clickEvent => {
    const box = clickEvent.target.getBoundingClientRect()
    const posX = 0 //clickEvent.target.parentNode.parentNode.scrollLeft
    const posY = 0 //_('#main > div').scrollTop
    const rootStyles = document.documentElement.style
    rootStyles.setProperty("--box-width",`${box.width}px`)
    rootStyles.setProperty("--box-height",`${box.height}px`)
    rootStyles.setProperty("--box-positionX",`${box.x}px`)
    rootStyles.setProperty("--box-positionY",`${box.y}px`)
    rootStyles.setProperty("--scrollX", `${posX}px`)
    rootStyles.setProperty("--scrollY", `${posY}px`)
}

anchor.addEventListener("click",setBoundingBox)

const toast = async (text,icon) => {
  const tpl = `<div class="toast toast-start">${text}</div>`
  anchor.parentNode.insertAdjacentHTML('afterbegin',tpl)
  const t = anchor.parentElement.firstElementChild
  console.log('toast',text,t)
  await nextFrame()
  t.classList.replace('toast-start','toast-end')
  await new Promise( resolve => setTimeout(() => {
    t.classList.replace('toast-end','toast-start')
    resolve()
    },2000)
  )
  setTimeout(() => t.remove(),2500)
}

/* helper für details view */
function scrollToTab(ind) {
  const scroller = _('div.card-content')
  const scrollerTitleBar = _('div.spacer div')
  const scrollStop = ind * scroller.clientWidth 
  scroller.scrollTo({left:scrollStop,behavior:'smooth'})
  for ( tab of scrollerTitleBar.children) tab.classList.remove('active-tab')
  scrollerTitleBar.children[ind].classList.add('active-tab')
}

function scroller() {
  let lastScrollPosY = 0
  let invisible = true
  let wait = false
  return () => {
    if (wait) return 
    const self = _('.card')
    const isScrollingUp = self.scrollTop - lastScrollPosY > 0
    const showArrows = () => {
      const arrows = __('.v-centered.ease-enter-end')
      for (arrow of arrows) { 
        arrow.classList.replace('ease-enter-end','ease-enter-start') 
      };
      setTimeout(() => { 
        for (arrow of arrows) { 
          arrow.classList.replace('ease-enter-start','ease-enter-end') 
        }},1000) 
    }
    if (isScrollingUp && invisible) {
        invisible = false
        showArrows()
        _('.spacer h1').classList.replace('invisible','visible')
        _('.spacer div').classList.replace('white','black')
        _('.card-image').classList.replace('visible','invisible')
        self.scrollTo({top:self.scrollTopMax,behavior: 'smooth'})
      } else if (!isScrollingUp && !invisible) {
        invisible = true
        showArrows()
        _('.spacer h1').classList.replace('visible','invisible')
        _('.spacer div').classList.replace('black','white')
        _('.card-image').classList.replace('invisible','visible')
        self.scrollTo({top:0,behavior: 'smooth'})
    }
    wait = true
    setTimeout(() => wait = false,100)
    lastScrollPosY = self.scrollTop
  }
}
const onScrollCard = scroller()

/* intersection observer for infinite scrolling */
const createEndOfListWatcher = observedElement => {
  const text = observedElement.text
  const nix = "mehr gibt's nicht"
  const fetchMoreItems = async ([oe]) => {
    if (!oe.isIntersecting) return
    observedElement.classList.add('loading')
    //observedElement.text = ''
    await new Promise(x => setTimeout(x,100))
    searchProvider.searchResultPager.fetchNextSearchResult()
    .then(resp => {
      if (!resp) {
        observedElement.classList.replace('loading','toast-start')
        observedElement.textContent = nix
        setTimeout(() => observedElement.classList.replace('toast-start','toast-end'),2000)
        watcher.disconnect()
        return
      }
      const html = searchProvider.listViewComponent(resp?.result||[])
      observedElement.classList.remove('loading')
      observedElement.insertAdjacentHTML('beforebegin',html)
    })
  }
  const watcher = new IntersectionObserver(fetchMoreItems)
  watcher.observe(observedElement)
  return watcher
}
/* form intersection observer */
const createFormObserver = observedElement => {
  const watcher = new IntersectionObserver(observedElement.toggleButtonGroup,{threshold:.1})
  watcher.observe(observedElement)
  return watcher
}

const searchGoogle = () => {
  googlePager = new GoogleBooksPager()
  searchProvider = {
    searchResultPager: googlePager,
    search: googlePager.search,
    listViewComponent: googleListViewComponent,
    listView: listView
  }
}
/* und los geht's */
let formWatcher, endOfListWatcher, selectedBook
let googlePager, dnbPager
const defaultSearchProvider = {
  searchResultPager: bookManager.searchResultPager,
  search: bookManager.search,
  reset: true,
  listViewComponent,listView
}
let searchProvider = defaultSearchProvider
const routes = [
    {
      pattern: /^\/$/,
      template: homeView,
      content: bookManager.fetchRandomSample
    },
    {
      pattern: /^\/(?=<category>.+?)\/?$/,
      template: categoriesView,
      content: bookManager.categories
    },
    {
      pattern: /^\/(?=<bookId>.+?)\/(?=<title>.+?)\/?$/,
      template: detailsView,
      content: bookManager.getBook
    },
    {
      pattern: /^\/suche\/?\?q=$/,
      template: categoriesView,
      content: bookManager.gotoCategories
    },
  ];

goto(homeView,homeTransition('entry'))
//bookManager.fetchBook().then(book => {
// goto(book => new BooxForm(book),'zoom-in',book)
//})
