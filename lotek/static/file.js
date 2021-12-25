import {SidePanel} from "/static/sidepanel.js";
import {SearchBar} from "/static/search.js";

function is_open_available(file, allow) {
    return allow.includes("open");
}

function open_onclick(id) {
    request(
        {method: "POST",
         url: "/:id",
         params: {id},
         headers: {"X-WOPI-Override": "X-LOTEK-OPEN"},
        }
    )
}

const File = {
    oninit(vnode) {
        const record = vnode.attrs.record;
        if (record.ext) {
            document.title = `${record.name || vnode.attrs.id }.${record.ext}`;
        } else {
            document.title = `${record.name || vnode.attrs.id }`;
        }

        vnode.state.index = 0;
        vnode.state.edit_title = null;
    },

    view(vnode) {
        const patch = vnode.attrs.patch;
        const modes = registry.modes.filter((mode) => mode.is_available(vnode.attrs.record, vnode.attrs.allow));
        const actions = registry.actions.filter((action) => action.is_available(vnode.attrs.record, vnode.attrs.allow));

        return [
            m(".container", {style: "position: relative;"},
              m(SidePanel,
                {isOpen: true,
                 style: "position: absolute;",
                 panel:
                 registry.widgets.map(
                     (widget) =>
                     m(widget,
                       {id: vnode.attrs.id,
                        file: vnode.attrs.record,
                        patch: patch}
                      )
                 )
                },
                m(".column-flex.container",
                  m(".row-flex",
                    {style: "align-items: center;"},
                    (vnode.state.edit_title !== null)?
                    m(CUI.ControlGroup,
                      {"class": "cui-fluid"},
                      m(CUI.Input,
                        {fluid: true,
                         value: vnode.state.edit_title,
                         onchange(e) { vnode.state.edit_title = e.target.value; }}
                       ),
                      m(CUI.Button,
                        {intent: "primary",
                         label: "Save",
                         onclick() {
                             patch(
                                 (vnode.attrs.record.name)?
                                     [{op: "replace", path: "/name", value: vnode.state.edit_title}]
                                     :
                                     [{op: "add", path: "/name", value: vnode.state.edit_title}],
                                 {'Subject': `Rename to ${vnode.state.edit_title}`}
                             );
                             vnode.state.edit_title = null;
                         }
                        }),
                      m(CUI.Button,
                        {label: "Cancel",
                         onclick() { vnode.state.edit_title = null; }})
                     )
                    :
                    m("h1.container",
                      vnode.attrs.record.name || "Untitled",
                      m(CUI.Icon,
                        {name: CUI.Icons.EDIT,
                         onclick() {
                             vnode.state.edit_title = vnode.attrs.record.name || "";
                         }}
                       )
                     ),
                    (modes.length > 0)?
                    m(CUI.ControlGroup,
                      {style: "flex-grow: 1; justify-content: flex-end;"},
                      m(CUI.PopoverMenu,
                        {trigger:
                         m(CUI.Button,
                           {style: "sm",
                            active: true,
                            label: modes[vnode.state.index].label,
                            size: "sm",
                            iconRight: CUI.Icons.CHEVRON_DOWN}
                          ),
                         content: [
                             modes.map(
                                 (mode, i) =>
                                 (i !== vnode.state.index)?
                                     m(CUI.MenuItem,
                                       {label: mode.label,
                                        onclick() { vnode.state.index = i; }
                                       }
                                      )
                                     :null
                             ),
                             m(CUI.MenuDivider),
                             actions.map(
                                 (action) =>
                                 m(CUI.MenuItem,
                                   {label: action.label,
                                    onclick() { action.onclick(vnode.attrs.id) }
                                   }
                                  )
                             )
                         ]
                        }
                       )
                     )
                    :null
                   ),
                  m(".container", {style: "position: relative;"},
                    (modes.length > 0)?
                    m(modes[vnode.state.index].component,
                      {key: vnode.state.index,
                       id: vnode.attrs.id,
                       file: vnode.attrs.record}):null
                   )
                 )
               )
             )

        ];
    }
};

export const types = {file: File};

export const registry = {
    widgets: [],
    modes: [],
    actions: [
        {label: "Open Containing Folder",
         is_available: is_open_available,
         onclick: open_onclick}
    ],
};
