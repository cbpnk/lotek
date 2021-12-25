export const SearchBar = {
    oninit: function(vnode) {
        vnode.state.value = new URLSearchParams(window.location.search).get("q");
    },

    view: function(vnode) {
        const exts = Object.keys(window.registry.exts || {});
        exts.sort();

        return m("form.cui-control-group",
                 {onsubmit(e) {
                     e.preventDefault();
                     m.route.set(m.buildPathname("/search/", {q: vnode.state.value}));
                  }
                 },
                 m(CUI.Input,
                   {value: vnode.state.value,
                    fluid: true,
                    oninput: (e) => {vnode.state.value = e.target.value; }}),
                 m(CUI.Button,
                   {intent: "primary",
                    type: "submit",
                    label: m(CUI.Icon, {name: CUI.Icons.SEARCH})
                   }
                  ),
                 (registry.searches.length===0)?null:
                 m(CUI.PopoverMenu,
                   {closeOnContentClick: true,
                    trigger:
                    m(CUI.Button,
                      {intent: "primary",
                       compact: true,
                       label: m(CUI.Icon, {name: CUI.Icons.CHEVRON_DOWN})}
                     ),
                    content: [
                        registry.searches.map(
                            (link) =>
                            m(CUI.MenuItem,
                              {label: link.name,
                               onclick() { m.route.set(m.buildPathname("/search/", {q: link.query})); }}
                             )
                        ),
                        m(CUI.MenuDivider),
                        exts.map(
                            (ext) =>
                            m(CUI.MenuItem,
                              {label: `${window.registry.exts[ext].name} (.${ext})`,
                               onclick() { m.route.set(m.buildPathname("/search/", {q: `ext:${ext}`})); }}
                             )
                        )
                    ]
                   }
                  )
                );
    }
};

const Search = {
    oninit(vnode) {
        document.title = (vnode.attrs.key)?('Search ' + vnode.attrs.key):'Search';
        request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.key, highlight: true}}
        ).then(
            function(results) {
                vnode.state.results = results;
            },
            function(error) {
                console.log(error);
            }
        );
    },

    view(vnode) {
        if (!vnode.attrs.key) {
            return m(".container", {style: "position: relative;"},
                     m(CUI.EmptyState,
                       {header: "Search",
                        content: m(SearchBar)}));
        }

        if (vnode.state.results === undefined) {
            return m(".container", {style: "position: relative;"},
                     m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."}));
        }

        if (vnode.state.results.length === 0) {
            return [
                m(SearchBar),
                m(".container", {style: "position: relative;"},
                  m(CUI.EmptyState,
                    {icon: CUI.Icons.ARCHIVE,
                     header: "No search results found"}))
            ];
        }

        return m("div.container.column-flex",
                 m(SearchBar),
                 m("div.container", {style: "position: relative;"},
                   m("div.container", {style: "position: absolute; overflow-y: auto;"},
                     vnode.state.results.map(
                         (result) =>
                         m(CUI.Card,
                           {fluid: true},
                           m("h4",
                             m(m.route.Link,
                               {href: "/" + result.id},
                               (result.name)?m.trust(result.name):result.id)
                            ),
                           (result.name)?m("h5", result.id):null,
                           m('', m.trust(result.excerpts))
                          )
                     )
                    )
                  )
                );
    }
}

export const routes = [
    ["/search/", (vnode) => m(Search, {key: new URLSearchParams(window.location.search).get("q")})]
];

export const links = [
    {url: "/search/",
     name: "Search"}
];

export const registry = {searches: []};
