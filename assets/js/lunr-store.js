---
# create unified lunr store for global + collection search
---
{% if site.data.theme.search-child-objects == true %}
{%- assign items = site.data[site.metadata] | where_exp: 'item','item.objectid' -%}
{% else %}
{%- assign items = site.data[site.metadata] | where_exp: 'item','item.objectid and item.parentid == nil' -%}
{% endif %}
{%- assign fields = site.data.config-search -%}
{%- assign index_fields = fields | where: 'index','true' -%}
{%- assign display_fields = fields | where: 'display','true' -%}

const store = [
  {%- assign has_entry = false -%}
  {%- for item in items -%}
    {%- capture item_title -%}
      {%- if item.title -%}
        {{ item.title | normalize_whitespace | replace: '""','"' }}
      {%- elsif item.name -%}
        {{ item.name | normalize_whitespace | replace: '""','"' }}
      {%- else -%}
        {{ item.objectid }}
      {%- endif -%}
    {%- endcapture -%}
    {%- capture item_body -%}
      {%- for f in index_fields -%}
        {%- if item[f.field] -%}
          {{ item[f.field] | normalize_whitespace | replace: '""','"' }} 
        {%- endif -%}
      {%- endfor -%}
    {%- endcapture -%}
    {%- capture item_meta -%}
      {%- if item.subject -%}
        {{ item.subject | normalize_whitespace | replace: '""','"' }}
      {%- elsif item.creator -%}
        {{ item.creator | normalize_whitespace | replace: '""','"' }}
      {%- elsif item.date -%}
        {{ item.date | normalize_whitespace | replace: '""','"' }}
      {%- endif -%}
    {%- endcapture -%}
    {%- capture item_preview -%}
      {%- if item.description -%}
        {{ item.description | normalize_whitespace | replace: '""','"' | truncate: 220 }}
      {%- elsif item.title -%}
        {{ item.title | normalize_whitespace | replace: '""','"' | truncate: 220 }}
      {%- else -%}
        {{ item.objectid | truncate: 220 }}
      {%- endif -%}
    {%- endcapture -%}
    {%- if has_entry -%},{%- endif -%}
    {
      "id": {{ 'collection:' | append: item.objectid | jsonify }},
      "sourceType": "collection",
      "title": {{ item_title | strip | jsonify }},
      "body": {{ item_body | strip | jsonify }},
      "meta": {{ item_meta | strip | jsonify }},
      "url": {% if item.parentid %}{{ '/items/' | append: item.parentid | append: '.html#' | append: item.objectid | relative_url | jsonify }}{% else %}{{ '/items/' | append: item.objectid | append: '.html' | relative_url | jsonify }}{% endif %},
      "preview": {{ item_preview | strip | jsonify }},
      {% for f in display_fields %}{% if item[f.field] %}{{ f.field | jsonify }}: {{ item[f.field] | normalize_whitespace | replace: '""','"' | jsonify }},{% endif %}{% endfor %}
      "objectid": {{ item.objectid | jsonify }}
    }
    {%- assign has_entry = true -%}
  {%- endfor -%}

  {%- assign page_candidates = site.pages | where_exp: "p","p.title and p.url" -%}
  {%- for page in page_candidates -%}
    {%- assign page_url = page.url | to_s -%}
    {%- assign skip_page = false -%}
    {%- if page.search == false -%}{%- assign skip_page = true -%}{%- endif -%}
    {%- if page_url == '/search/' or page_url == '/404.html' or page_url contains '/items/' or page_url contains '/assets/' -%}
      {%- assign skip_page = true -%}
    {%- endif -%}
    {%- unless skip_page -%}
      {%- capture page_body -%}
        {{ page.content | strip_html | normalize_whitespace | replace: '""','"' }}
      {%- endcapture -%}
      {%- capture page_preview -%}
        {{ page.content | strip_html | normalize_whitespace | replace: '""','"' | truncate: 220 }}
      {%- endcapture -%}
      {%- if has_entry -%},{%- endif -%}
      {
        "id": {{ 'page:' | append: page_url | jsonify }},
        "sourceType": "page",
        "title": {{ page.title | normalize_whitespace | replace: '""','"' | jsonify }},
        "body": {{ page_body | strip | jsonify }},
        "meta": {{ page.layout | default: '' | normalize_whitespace | jsonify }},
        "url": {{ page_url | relative_url | jsonify }},
        "preview": {{ page_preview | strip | jsonify }}
      }
      {%- assign has_entry = true -%}
    {%- endunless -%}
  {%- endfor -%}
];

if (typeof window !== 'undefined') {
  window.store = store;
}

export default store;
