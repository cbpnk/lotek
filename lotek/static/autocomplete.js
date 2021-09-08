import {levenshteinEditDistance} from "/static/vendor/npm/levenshtein-edit-distance@3.0.0/index.js";
import {Title} from "/static/view.js";

export const AutoCompleteInput = {
    oninit: function(vnode) {
        vnode.state.value = "";

        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.query}}
        ).then(
            function(result) {
                vnode.state.items = Object.fromEntries(result.map((item) => [item.path, item]));
                m.redraw();
            },
            function(error) {
                console.log(error);
            }
        );

    },

    view: function(vnode) {
        const autocomplete_items = Object.values(
            vnode.state.items || {}
        ).filter(
            (item) =>
            !(vnode.attrs.paths || []).includes(item.path));

        function oninput(e) {
            vnode.state.value = e.target.value;
            let items = autocomplete_items.map(
                (item) =>
                [levenshteinEditDistance(
                    (item.title_t || [""])[0],
                    vnode.state.value),
                 item]
            );
            items.sort((a,b) => a[0] - b[0]);
            items.slice(9);
            vnode.state.suggests = items.map(([_, item]) => item);
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

        if (!vnode.state.items) {
            return html`
<div class="input-group form-autocomplete">
  ${ vnode.attrs.addon?html`<span class="input-group-addon">${ vnode.attrs.addon }</span>`:null }
  <div class="form-autocomplete-input form-input">
    <div class="has-icon-left">
      <input class="form-input" />
      <i class="form-icon loading" />
    </div>
  </div>
</div>`;
        }

        return [
            (vnode.attrs.paths || []).map(
                (path) => html`
<div class="my-2">
  <div class="popover ${ vnode.attrs.popover }">
    <span class="chip">
      <${m.route.Link} href=${ m.buildPathname("/:path", {path}) }>
        <${Title} path=${path} doc=${ vnode.state.items[path] }><//>
      <//>
    </span>
    ${ (vnode.attrs.patch)?html`<button class="btn btn-clear" onclick=${ function() { remove_path(path); } }></button>`:null }
    <div class="popover-container">
      <div class="card">
        <div class="card-header">
          <div class="card-title h5"><${Title} doc=${ vnode.state.items[path] } path=${ path }><//></div>
          <div class="card-subtitle">${ path }</div>
        </div>
      </div>
    </div>
  </div>
</div>`),
            (!vnode.attrs.patch)?null:html`
<div class="input-group form-autocomplete">
  ${ (vnode.attrs.addon)?html`<span class="input-group-addon addon-sm">${ vnode.attrs.addon }</span>`:null }
  <input class="form-input input-sm" type="text" oninput=${ oninput } value="${ vnode.state.value }" />
  ${ (vnode.state.value === "")?null:html`
<ul class="menu">
  ${ vnode.state.suggests.map(
       (suggest) => html`
<li class="menu-item">
  <a onclick=${ function() { add_path(suggest.path); } }>
    <div class="tile">
      <div class="tile-content">
        <div class="tile-title text-bold">${ (suggest.title_t || ["Untitled"])[0] }</div>
        <div class="tile-subtitle">${ suggest.path }</div>
      </div>
    </div>
  </a>
</li>`) }
</ul>
` }
</div>`
];

    }
}
