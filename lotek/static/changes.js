const icons = {
    add: "PLUS",
    modify: "EDIT",
    delete: "X"};


function format_author(author) {
    if (author.id) {
        return m(m.route.Link,
                 {href: m.buildPathname("/~:id", {id: author.id})},
                  author.name)
    }
    return m("span", author.name, " <", author.email, ">")
}


const Changes = {
    oninit(vnode) {
        document.title = 'Recent Changes';
        vnode.state.changes = [];
        request(
            {method: "POST",
             url: "/changes/"}
        ).then(
            function(result) {
                vnode.state.changes = result;
            }
        )
    },

    view(vnode) {
        return m("div.container", {style: "position: relative;"},
                 m("div.container", {style: "position: absolute; overflow-y: auto;"},
                   m("div.timeline",
                     vnode.state.changes.map(
                         (change) =>
                         m("div.event",
                           m("div.title.row-flex", {style: "justify-content: space-between;"},
                             m("div", format_author(change.author)),
                             m("div", new Date(change.time * 1000).toLocaleString())
                            ),
                           m("div", change.message),
                           m(CUI.List,
                             change.changes.map(
                                 (item) =>
                                 m(CUI.ListItem,
                                   {label:
                                    m(m.route.Link,
                                      {href: m.buildPathname("/:id", {id: item.id})},
                                      item.id
                                     ),
                                    contentLeft:
                                    m(CUI.Icon,
                                      {name: CUI.Icons[icons[item.type]]}
                                     )
                                   }
                                  )
                             )
                            )
                          )
                     )
                    )
                  )
                );
    }
}

export const routes = [
    ["/changes/", (vnode) => m(Changes)]
];

export const links = [{url: "/changes/", name: "Recent Changes"}];
