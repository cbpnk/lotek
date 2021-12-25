import {levenshteinEditDistance} from "/static/vendor/npm/levenshtein-edit-distance@3.0.0/index.js";

function debounce(func, wait) {
    let timer = null;
    return function(...args) {
        if (timer !== null) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(func, wait, ...args);
    }
}

const update_query_list = debounce(
    function(vnode) {
        const { items, itemPredicate, itemListPredicate } = vnode.attrs;

        if (typeof(itemListPredicate) === 'function') {
            vnode.state.filtered_items = itemListPredicate(vnode.state.query, items);
        } else if (typeof(itemPredicate) === 'function') {
            vnode.state.filtered_items = items.filter((item, index) => itemPredicate(vnode.state.query, item, index));
        } else {
            vnode.state.filtered_items = items;
        }

        vnode.state.active = 0;
        m.redraw();
    },
    200
);

const PopoverQueryList = {
    oninit(vnode) {
        vnode.state.query = '';
        vnode.state.active = 0;
        vnode.state.filtered_items = [];
        vnode.state.isOpen = false;
        update_query_list(vnode);
    },

    view(vnode) {
        return m('',
                 {onkeydown(e) {
                     switch (e.key) {
                     case "ArrowUp":
                         if (vnode.state.active > 0) {
                             vnode.state.active -= 1;
                         }
                         break;
                     case "ArrowDown":
                         if (vnode.state.active + 1 < vnode.state.filtered_items.length) {
                             vnode.state.active += 1;
                         }
                         break;
                     case "Enter":
                         vnode.attrs.onSelect(vnode.state.filtered_items[vnode.state.active]).then(
                             function() {
                                 update_query_list(vnode);
                             }
                         );
                         break;
                     case "Escape":
                         vnode.state.isOpen = false;
                         break;
                     }
                 }
                 },
                 m(CUI.Popover,
                   {isOpen: vnode.state.isOpen && (vnode.state.filtered_items.length > 0),
                    hasArrow: false,
                    position: "bottom-start",
                    trigger:
                    m(CUI.Input,
                      {...(vnode.attrs.inputAttrs || {}),
                       onfocus() {
                           vnode.state.isOpen = true;
                       },
                       onblur() {
                           vnode.state.isOpen = false;
                       },
                       oninput(e) {
                           vnode.state.isOpen = true;
                           const value = e.target.value;
                           vnode.state.query = value;
                           update_query_list(vnode);
                       },
                       value: vnode.state.query}
                     ),
                    content: m(CUI.List,
                               vnode.state.filtered_items.map(
                                   function(item, index) {
                                       const list_item = vnode.attrs.itemRender(item, index);
                                       if (index == vnode.state.active) {
                                           list_item.attrs.class = (list_item.attrs.class || "") + " cui-active";
                                           list_item.attrs.onclick = function() {
                                               vnode.attrs.onSelect(item).then(
                                                   function() {
                                                       update_query_list(vnode);
                                                   }
                                               );
                                           }
                                       }
                                       return list_item;
                                   }
                               )
                              )
                   }
                  )
                );
    }
};

export const AutoCompleteInput = {
    oninit(vnode) {
        request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.query}
            }
        ).then(
            function(result) {
                vnode.state.items_by_id = Object.fromEntries(result.map((item) => [item.id, item]));
            }
        );
    },

    view(vnode) {
        const items_by_id = vnode.state.items_by_id;
        if (!items_by_id) {
            return m(CUI.Spinner,
                     {fill: true,
                      size: "xl"});
        }

        function filter_items(query, items) {
            let items1 = items.map(
                (item) =>
                [levenshteinEditDistance(
                    (item.name || ""),
                    query),
                 item]
            );
            items1.sort((a,b) => a[0] - b[0]);
            items1.slice(9);
            return items1.map(([_, item]) => item);
        }

        function add_id(id) {
            return vnode.attrs.patch(
                (vnode.attrs.ids)?
                [{op: "add", path: `/${vnode.attrs.attribute}/-`, value: id}]
                :
                [{op: "add", path: `/${vnode.attrs.attribute}`, value: [id]}],
                {'Subject': `add to ${vnode.attrs.attribute} attribute ${items_by_id[id].name || id} (${id})`}
            );
        }

        function remove_id(id) {
            return vnode.attrs.patch(
                [{op: "remove", path: `/${vnode.attrs.attribute}/${vnode.attrs.ids.indexOf(id)}`}],
                {'Subject': `remove from ${vnode.attrs.attribute} attribute ${items_by_id[id].name || id} (${id})`}
            );
        }

        return [
            (vnode.attrs.ids || []).map(
                (id) =>
                m(CUI.Popover,
                  {interactionType: "hover",
                   trigger: m(CUI.Tag,
                              {onRemove() { remove_id(id); },
                               label: items_by_id[id].name || id}),
                   content: m(CUI.Card,
                              m("h4", items_by_id[id].name || "Untitled"),
                              m("", id)
                             )
                  }
                 )
            ),

            m(PopoverQueryList,
              {cacheItems: false,
               inputAttrs: {
                   placeholder: vnode.attrs.placeholder
               },
               items: Object.values(items_by_id || {}).filter(
                   (item) =>
                   !(vnode.attrs.ids || []).includes(item.id)),
               itemListPredicate: filter_items,
               itemRender(suggest) {
                   return m(CUI.ListItem,
                            {label: (suggest.name || "Untitled")}
                           );
               },
               onSelect(suggest) {
                   return add_id(suggest.id);
               }
              }
             )
        ];

    }
};
