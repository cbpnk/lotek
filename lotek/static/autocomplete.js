import {levenshteinEditDistance} from "/static/vendor/npm/levenshtein-edit-distance@3.0.0/index.js";
import {Title} from "/static/view.js";
import {Reload} from "/static/reload.js";

export class AutoCompleteInput extends Reload {
    oninit(vnode) {
        super.oninit(vnode);
    }

    load(vnode) {
        return async function() {
            let result = await m.request(
                {method: "POST",
                 url: "/search/",
                 body: {q: vnode.attrs.query}}
            );
            return Object.fromEntries(result.map((item) => [item.path, item]));
        };
    }

    render(items_by_path, vnode) {
        function filter_items(query, items) {
            let items1 = items.map(
                (item) =>
                [levenshteinEditDistance(
                    (item.title_t || [""])[0],
                    query),
                 item]
            );
            items1.sort((a,b) => a[0] - b[0]);
            items1.slice(9);
            return items1.map(([_, item]) => item);
        }

        function add_path(path) {
            vnode.attrs.patch(
                (vnode.attrs.paths)?
                [{op: "add", path: `/${vnode.attrs.attribute}/-`, value: path}]
                :
                [{op: "add", path: `/${vnode.attrs.attribute}`, value: [path]}]
            );
            vnode.state.value = "";
        }

        function remove_path(path) {
            vnode.attrs.patch(
                [{op: "remove", path: `/${vnode.attrs.attribute}/${vnode.attrs.paths.indexOf(path)}`}]
            );
        }

        return [
            (vnode.attrs.paths || []).map(
                (path) =>
                m(CUI.Popover,
                  {interactionType: "hover",
                   trigger: m(CUI.Tag, {onRemove: () => remove_path(path), label: m(Title, {path, doc: items_by_path[path]})}),
                   content: m(CUI.Card,
                              m("h4", m(Title, {path, doc: items_by_path[path]})),
                              m("", path)
                             )
                  }
                 )
            ),
            (!vnode.attrs.patch)?null:
            m(CUI.QueryList,
              {cacheItems: false,
               items: Object.values(items_by_path || {}).filter(
                   (item) =>
                   !(vnode.attrs.paths || []).includes(item.path)),
               itemListPredicate: filter_items,
               itemRender: function(suggest) {
                   return m(CUI.ListItem,
                     {label: (suggest.title_t || ["Untitled"])[0]}
                    );
               },
               onSelect: function(suggest) {
                   add_path(suggest.path);
               }
              }
             )
        ];

    }
}
