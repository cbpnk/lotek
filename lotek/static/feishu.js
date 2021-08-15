const Editor = {
    view: function(vnode) {
        function onclick(event) {
            vnode.attrs.save();
        }

        return html`
<aside class="top">
  <div class="form-horizontal">
    <div class="form-group">
      <div class="column col-3">
        <label class="form-label">Revision</label>
      </div>
      <div class="column">
        <label class="form-label">${ (vnode.attrs.doc.revision_n || [0])[0] }</label>
      </div>
      <div>
        <button class="btn btn-primary" onclick=${ onclick }>Save</button>
        <button class="btn" onclick=${ function(event) { event.preventDefault(); vnode.attrs.hide(); } }>Cancel</button>
      </div>
    </div>
  </div>
</aside>
<div style="grid-column: 1 / span 3; margin: 1em;">
  <iframe style="margin: 0 auto; width: 100%; height: 100%;" src=${ EDITOR_URL + m.buildPathname("/docs/:token", {token: vnode.attrs.doc.feishu_token_i[0]}) }></iframe>
</div>`;
    }
}

export const editor_widgets = [Editor];
