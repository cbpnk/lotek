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
                (item) => html`
<div class="my-2">
  <div class="popover popover-left">
    <span class="chip">
      <div class="popover-container">
        <div class="card">
          <div class="card-header">
            <div class="card-title h5">
              <${Title} doc=${ item } item=${ item.path }><//>
            </div>
            <div class="card-subtitle">${ item.path }</div>
          </div>
        </div>
      </div>
    </span>
  </div>
</div>`)
        ];
    }
}

export const right_widgets = [Widget];
