import {Title} from "/static/view.js";

const Editor = {
    view: function(vnode) {
        function onsubmit(event) {
            event.preventDefault();
            let form = new FormData(event.target);
            let title = form.get("title");
            let content = form.get("content");
            let patch = [{op: "replace", path: "/content", value: content}];
            if (title.length > 0) {
                if (vnode.attrs.doc.title_t) {
                    patch.push({op: "replace", path: "/title_t/0", value: title});
                } else {
                    patch.push({op: "add", path: "/title_t", value: [title]});
                }
            } else {
                if (vnode.attrs.doc.title_t) {
                    patch.push({op: "remove", path: "/title_t"})
                }
            }

            vnode.attrs.patch(
                patch
            ).then(
                function() {
                    vnode.attrs.hide();
                }
            );
        }

        return html`
<form class="d-flex" style="flex-direction: column; grid-area: main; margin: 1em;" onsubmit=${ onsubmit }>
  <h2 class="input-group">
    <input class="form-input" name="title" placeholder="Title" value="${ (vnode.attrs.doc.title_t || [""])[0] }" />
    <button class="input-group-btn btn btn-primary">Save</button>
    <button class="btn input-group-btn" onclick=${ function(event) { event.preventDefault(); vnode.attrs.hide(); } }>Cancel</button>
  </h2>
  <textarea name="content" style="margin: 0 auto; width: 100%; height: 100%;">${ vnode.attrs.doc.content }</textarea>
</form>`;
    }
}


export const editor_widgets = [Editor];
