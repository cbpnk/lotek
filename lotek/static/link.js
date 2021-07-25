import {AutoCompleteInput} from "/static/autocomplete.js";
import {Title} from "/static/view.js";

const Widget = {
    oninit: function(vnode) {
        vnode.state.items = [];
        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: `link_i:${vnode.attrs.path}`}}
        ).then(
            function(result) {
                vnode.state.items = result;
                m.redraw();
            },
            function(error) {
                console.log(error);
            }
        );

    },

    view: function(vnode) {
        return [
            (vnode.state.items.length>0)?m("div.divider", {"data-content": "Links to this"}):null,
            vnode.state.items.map(
                (item) =>
                m("div.my-2",
                  m("div.popover",
                    m("span.chip",
                      m(m.route.Link,
                        {href: m.buildPathname("/view/:path...", {path: item.path})},
                        m(Title, {doc: item, path: item.path})
                       ),
                      m("div.popover-container",
                        m("div.card",
                          m("div.card-header",
                            m("div.card-title.h5", m(Title, {doc: item, item: item.path})),
                            m("div.card-subtitle", item.path)
                           )
                         )
                       )
                     )
                   )
                 )
            )
        ];
    }
}

export const right_widgets = [Widget];
