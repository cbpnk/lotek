const icons = {
    "add": "icon-plus",
    "modify": "icon-edit",
    "delete": "icon-delete"
};

function format_link(item) {
    if (item.link) {
        if (item.link.endsWith(".txt")) {
            return m(m.route.Link, {href: "/view/" + item.link}, item.title || item.path);
        }
        return m("a", {href: "/files/" + item.link}, item.title || item.path)
    } else {
        return m("span", item.path)
    }
}

function format_author(author) {
    if (author.path) {
        return m(m.route.Link,
                 {href: m.buildPathname("/view/:path...", {path: author.path})},
                  author.name)
    }
    return m("span", author.name, " <", author.email, ">")
}

const Changes = {
    oninit: function(vnode) {
        vnode.state.changes = [];
        document.title = 'Recent Changes';
        m.request(
            {method: "POST",
             url: "/changes"
            }
        ).then(
            function(result) {
                vnode.state.changes = result;
                m.redraw();
            }
        );
    },

    view: function(vnode) {
        return m(
            "main",
            m("div.timeline",
              vnode.state.changes.map(
                  (change) =>
                  m("div.timeline-item",
                    m("div.timeline-left",
                      m("span.timeline-icon.icon-lg", m("i.icon"))
                     ),
                    m("div.timeline-content",
                      m("div.tile",
                        m("div.tile-content",
                          m("p.tile-subtitle",
                            new Date(change.time * 1000).toLocaleString()),
                          m("p.tile-title",
                            m("i.icon.icon-people"),
                            format_author(change.author)),
                          m("p.tile-tile", change.message),
                          change.changes.map(
                              (item) => 
                              m("p.tile-title",
                                m("i.icon", {"class": icons[item.type]}),
                                format_link(item)
                               )
                          )
                         )
                       )
                     )
                   )
              )
             )
        );
    }
};

export const routes = {
    "/changes": (vnode) => m(Changes),
}

export const links = [{url: "/changes", name: "Recent Changes"}]
