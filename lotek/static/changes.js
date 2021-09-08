const icons = {
    "add": "icon-plus",
    "modify": "icon-edit",
    "delete": "icon-delete"
};

function format_link(item) {
    if (item.link) {
        return m(m.route.Link, {href: "/" + item.link}, item.title || item.path);
    } else {
        return m("span", item.path)
    }
}

function format_author(author) {
    if (author.path) {
        return m(m.route.Link,
                 {href: m.buildPathname("/:path...", {path: author.path})},
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
        return html`
<main>
  <div class="timeline">
  ${ vnode.state.changes.map(
       (change) => html`
<div class="timeline-item">
  <div class="timeline-left">
    <span class="timeline-icon icon-lg">
      <i class="icon" />
    </span>
  </div>
  <div class="timeline-content">
    <div class="tile">
      <div class="tile-content">
        <p class="tile-subtitle">
          ${ new Date(change.time * 1000).toLocaleString() }
        </p>
        <p class="tile-title">
          <i class="icon icon-people" />
          ${ format_author(change.author) }
        </p>
        <p class="tile-title">
          ${ change.message }
        </p>
        ${ change.changes.map(
             (item) => html`
<p class="tile-title">
  <i class="icon ${icons[item.type]}" />
  ${ format_link(item) }
</p>`) }
      </div>
    </div>
  </div>
</div>`)
  }
  </div>
</main>`;
    }
};

export const routes = {
    "/changes": (vnode) => m(Changes),
}

export const links = [{url: "/changes", name: "Recent Changes"}]
