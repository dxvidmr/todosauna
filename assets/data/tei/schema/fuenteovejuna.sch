<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt2">
   <title>ISO Schematron rules</title>
   <!-- This file generated 2026-11-18T10:37:41Z by 'extract-isosch.xsl'. -->
   <!-- ********************* -->
   <!-- namespaces, declared: -->
   <!-- ********************* -->
   <ns prefix="tei" uri="http://www.tei-c.org/ns/1.0"/>
   <ns prefix="xs" uri="http://www.w3.org/2001/XMLSchema"/>
   <ns prefix="rng" uri="http://relaxng.org/ns/structure/1.0"/>
   <ns prefix="rna" uri="http://relaxng.org/ns/compatibility/annotations/1.0"/>
   <ns prefix="sch" uri="http://purl.oclc.org/dsdl/schematron"/>
   <ns prefix="sch1x" uri="http://www.ascc.net/xml/schematron"/>
   <!-- *********************************************************** -->
   <!-- constraints in es, en, und, mul, zxx, of which there are 40 -->
   <!-- *********************************************************** -->
   <pattern id="schematron-constraint-CMC_generatedBy_within_post-1">
      <rule context="tei:*[@generatedBy]">
         <assert test="ancestor-or-self::tei:post">The @generatedBy attribute is for use within a &lt;post&gt; element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-att-datable-w3c-when-2">
      <rule context="tei:*[@when]">
         <report test="@notBefore|@notAfter|@from|@to" role="nonfatal">The @when attribute cannot be used with any other att.datable.w3c attributes.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-att-datable-w3c-from-3">
      <rule context="tei:*[@from]">
         <report test="@notBefore" role="nonfatal">The @from and @notBefore attributes cannot be used together.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-att-datable-w3c-to-4">
      <rule context="tei:*[@to]">
         <report test="@notAfter" role="nonfatal">The @to and @notAfter attributes cannot be used together.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-only_1_ODD_source-5">
      <rule context="tei:*[@source]">
         <let name="srcs" value="tokenize( normalize-space(@source),' ')"/>
         <report test="(   self::tei:classRef                                 | self::tei:dataRef                                 | self::tei:elementRef                                 | self::tei:macroRef                                 | self::tei:moduleRef                                 | self::tei:schemaSpec )                                   and                                   $srcs[2]"> When used on a schema description element (like &lt;<value-of select="name(.)"/>&gt;), the @source attribute should have only 1 value. (This one has <value-of select="count($srcs)"/>.)</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-targetLang-6">
      <rule context="tei:*[not(self::tei:schemaSpec)][@targetLang]">
         <assert test="@target">@targetLang should only be used on &lt;<name/>&gt; if @target is specified.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-spanTo-points-to-following-7">
      <rule context="tei:*[ starts-with( @spanTo, '#') ]">
         <assert test="id( substring( @spanTo, 2 ) ) &gt;&gt; ."> The element indicated by @spanTo (<value-of select="@spanTo"/>) must follow the current &lt;<name/>&gt; element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-subtypeTyped-8">
      <rule context="tei:*[@subtype]">
         <assert test="@type"> The &lt;<name/>&gt; element should not be categorized in detail with @subtype unless also categorized in general with @type.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-calendar_attr_on_empty_element-9">
      <rule context="tei:*[@calendar]">
         <assert test="string-length( normalize-space(.) ) gt 0"> @calendar indicates one or more systems or calendars to which the date represented by the content of this element belongs, but this &lt;<name/>&gt; element has no textual content.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-abstractModel-structure-p-in-ab-or-p-10">
      <rule context="tei:p">
         <report test="(ancestor::tei:ab or ancestor::tei:p) and                        not( ancestor::tei:floatingText                           | parent::tei:exemplum                           | parent::tei:item                           | parent::tei:note                           | parent::tei:q                           | parent::tei:quote                           | parent::tei:remarks                           | parent::tei:said                           | parent::tei:sp                           | parent::tei:stage                           | parent::tei:cell                           | parent::tei:figure )"> Abstract model violation: Paragraphs may not occur inside other paragraphs or &lt;ab&gt; elements.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-abstractModel-structure-p-in-l-11">
      <rule context="tei:l//tei:p">
         <assert test="ancestor::tei:floatingText | parent::tei:figure | parent::tei:note"> Abstract model violation: Metrical lines (&lt;l&gt; elements) may not contain higher-level structural elements such as &lt;div&gt;, &lt;p&gt;, or &lt;ab&gt;, unless &lt;p&gt; is a child of &lt;figure&gt; or &lt;note&gt;, or is a descendant of &lt;floatingText&gt;.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-refAtts-12">
      <rule context="tei:ref">
         <report test="@target and @cRef">Only one of the attributes @target and @cRef may be supplied on &lt;<name/>&gt;.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-targetorcontent1-13">
      <rule context="tei:relatedItem">
         <report test="@target and count( child::* ) &gt; 0">If the @target attribute on <name/> is used, the relatedItem element must be empty.</report>
         <assert test="@target or child::*">A relatedItem element should have either a @target attribute or a child element to indicate the related bibliographic item.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-abstractModel-structure-l-in-l-14">
      <rule context="tei:l">
         <report test="ancestor::tei:l[not(.//tei:note//tei:l[. = current()])]">Abstract model violation: Metrical lines (&lt;l&gt; elements) may not contain &lt;l&gt; or &lt;lg&gt; elements.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-abstractModel-structure-div-in-l-15">
      <rule context="tei:l//tei:div">
         <assert test="ancestor::tei:floatingText"> Abstract model violation: Metrical lines (&lt;l&gt; elements) may not contain higher-level structural elements such as &lt;div&gt;, unless &lt;div&gt; is a descendant of &lt;floatingText&gt;.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-abstractModel-structure-div-in-ab-or-p-16">
      <rule context="tei:div">
         <report test="(ancestor::tei:p or ancestor::tei:ab) and not(ancestor::tei:floatingText)"> Abstract model violation: &lt;p&gt; and &lt;ab&gt; may not contain higher-level structural elements such as &lt;div&gt;, unless &lt;div&gt; is a descendant of &lt;floatingText&gt;.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-ref-or-key-or-name-17">
      <rule context="tei:relation">
         <assert test="@ref or @key or @name">One of the attributes @name, @ref or @key must be supplied.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-active-mutual-18">
      <rule context="tei:relation">
         <report test="@active and @mutual">Only one of the attributes @active and @mutual may be supplied.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-active-passive-19">
      <rule context="tei:relation">
         <report test="@passive and not(@active)">the attribute @passive may be supplied only if the attribute @active is supplied.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-act-20">
      <rule context="tei:div[@type = 'act']">
         <assert test="matches(@n, '^[1-9]$')">Cada acto lleva n con su número (1, 2, 3).</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-sp-21">
      <rule context="tei:sp">
         <assert test="@xml:id = concat('sp-', count(preceding::tei:sp) + 1)">El parlamento <value-of select="@xml:id"/> debería ser sp-<value-of select="count(preceding::tei:sp) + 1"/>: los parlamentos se numeran en el orden del documento.</assert>
         <assert test="every $w in tokenize(normalize-space(@who), ' ') satisfies (starts-with($w, '#') and exists(id(substring($w, 2))[self::tei:person or self::tei:personGrp]))">who="<value-of select="@who"/>" debe remitir (#id) a un person o personGrp declarado.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-l-22">
      <rule context="tei:l[not(@part)]">
         <assert test="matches(@n, '^[1-9][0-9]*$')">Un verso entero lleva n con su número.</assert>
         <assert test="@xml:id = concat('l-', @n)">El verso <value-of select="@n"/> debe tener xml:id="l-<value-of select="@n"/>".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-l-23">
      <rule context="tei:l[@part = 'I']">
         <assert test="matches(@n, '^[1-9][0-9]*$')">La parte inicial de un verso partido lleva n con su número.</assert>
         <assert test="@xml:id = concat('l-', @n, '-a')">La parte inicial del verso <value-of select="@n"/> debe tener xml:id="l-<value-of select="@n"/>-a".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-l-24">
      <rule context="tei:l[@part = ('M', 'F')]">
         <let name="inicio" value="preceding::tei:l[@part = 'I'][1]"/>
         <assert test="not(@n)">Solo la parte inicial de un verso partido lleva n.</assert>
         <assert test="matches(@xml:id, concat('^l-', $inicio/@n, '-[b-z]$'))">La parte <value-of select="@part"/> de un verso partido debe tener xml:id="l-<value-of select="$inicio/@n"/>-b" (o -c...), con el número de su parte inicial.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-stage-25">
      <rule context="tei:stage">
         <let name="v" value="(preceding::tei:l[@n][1]/@n, '1')[1]"/>
         <assert test="matches(@xml:id, concat('^stg-', $v, '(-[1-9][0-9]*)?$'))">La acotación <value-of select="@xml:id"/> sigue al verso <value-of select="$v"/>: debe ser stg-<value-of select="$v"/> o stg-<value-of select="$v"/>-k.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-seg-26">
      <rule context="tei:seg[ancestor::tei:l]">
         <let name="id-verso" value="string(ancestor::tei:l[1]/@xml:id)"/>
         <let name="v"
              value="if (matches($id-verso, '^l-[0-9]+')) then xs:integer(replace($id-verso, '^l-([0-9]+).*$', '$1')) else -1"/>
         <assert test="matches(@xml:id, concat('^seg-', $v, '-[1-9][0-9]*$')) or @xml:id = concat('seg-', $v, '-', $v + 1, '-a') or @xml:id = concat('seg-', $v - 1, '-', $v, '-b')">El segmento <value-of select="@xml:id"/> está en el verso <value-of select="$v"/>: debe ser seg-<value-of select="$v"/>-k (o seg-V-V+1-a / -b si cruza dos versos).</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-seg-27">
      <rule context="tei:seg[ancestor::tei:stage]">
         <assert test="matches(@xml:id, concat('^seg-', ancestor::tei:stage[1]/@xml:id, '-[1-9][0-9]*$'))">El segmento <value-of select="@xml:id"/> está en la acotación <value-of select="ancestor::tei:stage[1]/@xml:id"/>: debe ser seg-<value-of select="ancestor::tei:stage[1]/@xml:id"/>-k.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-role-28">
      <rule context="tei:role">
         <assert test="matches(@xml:id, '^dp-[a-z0-9_]+$')">El xml:id de un role empieza por dp-.</assert>
         <assert test="starts-with(@corresp, '#') and exists(id(substring(@corresp, 2))[self::tei:person or self::tei:personGrp])">corresp="<value-of select="@corresp"/>" debe remitir (#id) a un person o personGrp de este archivo.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-milestone-29">
      <rule context="tei:milestone">
         <report test="@unit = 'metrical-section' and not(matches(@n, '^[0-9]+-[0-9]+$'))">Una sección métrica lleva n con su rango de versos (por ejemplo, n="1-68").</report>
         <assert test="every $a in tokenize(normalize-space(@ana), ' ') satisfies (starts-with($a, '#') and exists(id(substring($a, 2))[self::tei:category][ancestor::tei:taxonomy[@xml:id = ('metrica', 'rima', 'irregularidades')]]))">ana="<value-of select="@ana"/>": cada valor debe remitir (#id) a una categoría de las taxonomías metrica, rima o irregularidades.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-resp-30">
      <rule context="tei:*[@resp] | tei:change[@who]">
         <assert test="every $r in tokenize(normalize-space(string-join((@resp, self::tei:change/@who), ' ')), ' ') satisfies (starts-with($r, '#') and exists(id(substring($r, 2))))">"<value-of select="string-join((@resp, self::tei:change/@who), ' ')"/>" debe remitir (#id) a una persona declarada en este archivo.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-prefijos-31">
      <rule context="tei:*[@target or @source or @active or @passive]">
         <let name="valores"
              value="for $t in (@target, @source, @active, @passive) return tokenize(normalize-space($t), ' ')"/>
         <let name="defs" value="//tei:prefixDef"/>
         <let name="malos"
              value="for $t in $valores[matches(., '^[a-z][a-z0-9]*:')][not(matches(., '^https?:'))] return (if (some $d in $defs[@ident = substring-before($t, ':')] satisfies matches(substring-after($t, ':'), concat('^(', $d/@matchPattern, ')$'))) then () else $t)"/>
         <assert test="empty($malos)">Valor con prefijo que ningún prefixDef de este archivo declara o cuyo patrón no cumple: <value-of select="string-join($malos, ' ')"/>
         </assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-note-32">
      <rule context="tei:note">
         <assert test="matches(@xml:id, '^n-([0-9]+|stg-[0-9]+(-[0-9]+)?)-[1-9][0-9]*$')">El xml:id de una nota sigue el patrón n-V-k o n-stg-...-k.</assert>
         <assert test="every $t in tokenize(normalize-space(@target), ' ') satisfies starts-with($t, 'texto:')">Cada valor de target lleva el prefijo texto: (<value-of select="@target"/>).</assert>
         <assert test="every $a in tokenize(normalize-space(@ana), ' ') satisfies (starts-with($a, '#') and exists(id(substring($a, 2))[self::tei:category]))">ana="<value-of select="@ana"/>" debe remitir (#id) a una categoría de la taxonomía de notas.</assert>
         <assert test="every $c in tokenize(normalize-space(@change), ' ') satisfies (starts-with($c, '#') and exists(id(substring($c, 2))[self::tei:change]))">change="<value-of select="@change"/>": cada valor debe remitir (#id) a un change del revisionDesc.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fo-relation-33">
      <rule context="tei:relation">
         <assert test="every $a in tokenize(normalize-space(@active), ' ') satisfies starts-with($a, 'cb:')">active lleva el prefijo cb: (objeto de la colección).</assert>
         <assert test="every $p in tokenize(normalize-space(@passive), ' ') satisfies starts-with($p, 'texto:')">Cada valor de passive lleva el prefijo texto: (pasaje del texto base).</assert>
         <assert test="@xml:id = concat('rel-', substring-after(@active, 'cb:'))">El xml:id de la relación debe ser rel- seguido del objeto de active (rel-<value-of select="substring-after(@active, 'cb:')"/>).</assert>
      </rule>
   </pattern>
</schema>
