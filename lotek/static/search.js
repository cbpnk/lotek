import {Link} from "/static/view.js";
import {Reload} from "/static/reload.js";

const Action = {
    oninit: function(vnode) {
        vnode.state.value = new URLSearchParams(window.location.search).get("q");
    },

    view: function(vnode) {
        return [
            m(CUI.Input,
              {value: vnode.state.value,
               oninput: (e) => {vnode.state.value = e.target.value; }}),
            m(CUI.Button,
              {intent: "primary",
               label: m(CUI.Icon, {name: CUI.Icons.SEARCH}),
               onclick: () => m.route.set(m.buildPathname("/search/", {q: vnode.state.value}))}
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
               content: registry.searches.map(
                   (link) =>
                   m(CUI.MenuItem,
                     {label: link.name,
                      onclick: () => m.route.set(m.buildPathname("/search/", {q: link.query}))}
                    )
               )
              }
             )
        ];
    }
};

class Search extends Reload {
    oninit(vnode) {
        super.oninit(vnode);
        document.title = 'Search ' + vnode.attrs.key;
    }

    load(vnode) {
        return () => m.request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.key, highlight: true}}
        );
    }

    render(results) {
        return results.map(
     (result) => html`
<div class="card my-1">
  <div class="card-header">
    <div class="card-title h4 text-ellipsis">
      <${Link} key=${result.path} doc=${result}><//>
    </div>
    <div class="card-subtitle">${ result.path }</div>
  </div>
  <div class="card-body">
    ${ m.trust(result.excerpts) }
  </div>
</div>`);
    }

    view(vnode) {
        return m("main", super.view(vnode));
    }
}

export const routes = {
    "/search/": (vnode) => m(Search, {key: new URLSearchParams(window.location.search).get("q")})
};

export const actions = [Action];

export const registry = {searches: []};
