熵增主义个人信息管理工具，核心概念都是从trilium那里抄来的。文件存在git
仓库里，文件内容包含元信息以及Markdown格式的正文，通过JSON Patch(RFC
6902)编辑元信息，Markdown内容通过外接编辑器编辑，页面上的功能都由插件
查询全文索引来实现。

使用熵增主义技术栈开发。

* mithril.js
* spectre.css
* wheezy
* dulwich

```
uwsgi uwsgi.ini
```
