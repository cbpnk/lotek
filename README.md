个人信息管理工具，使用熵增主义技术栈开发。

* mithril.js
* construct-ui
* htm
* wheezy.web
* dulwich
* whoosh
* pdfminer.six
* hypothesis

核心概念都是从trilium那里抄来的。文件存在git仓库里，文件内容包含元信息
以及Markdown格式的正文，通过JSON Patch(RFC 6902)编辑元信息，Markdown内
容通过外接编辑器编辑，页面上的功能都由插件查询全文索引来实现。集成
Hypothesis每个Markdown文件以及导入的PDF文件都可以加批注。

## 元信息类型

| 后缀 | 类型 |
| - | - |
| \_i | ID |
| \_t | 文本 |
| \_n | 数值 |
| \_d | 日期 |

### Category

`category_i` 用来记录Markdown文件的Category。一个Markdown文件可以有多
个Category。某个具体的Category的显示由对应的插件提供。

## Quickstart

```
uwsgi uwsgi.ini
```
