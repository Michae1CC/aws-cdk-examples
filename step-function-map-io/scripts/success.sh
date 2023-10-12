#!/bin/bash

set -euox pipefail

# Check that the url has been provided
if [[ "$#" -ne 1 ]]; then
    echo "Expected endpoint url"
    exit 1
fi

BASE_URL='https://www.fluentpython.com/data/flags';
COUNTRY_CODES='ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cz de dj dk dm dz ec ee eg es et fi fm fr ga gd ge gh gm gn gq ht ht hu id ie il in iq ir is it jm jo jp ke kh ki km kp kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml';
RESOURCE_PATHS=''\
'"ad/ad.gif","ae/ae.gif","af/af.gif","ag/ag.gif","al/al.gif","am/am.gif",'\
'"ao/ao.gif","ar/ar.gif","at/at.gif","au/au.gif","az/az.gif","ba/ba.gif",'\
'"bb/bb.gif","bd/bd.gif","be/be.gif","bf/bf.gif","bg/bg.gif","bh/bh.gif",'\
'"bi/bi.gif","bj/bj.gif","bn/bn.gif","bo/bo.gif","br/br.gif","bs/bs.gif",'\
'"bt/bt.gif","bw/bw.gif","by/by.gif","bz/bz.gif","ca/ca.gif","cd/cd.gif",'\
'"cf/cf.gif","cg/cg.gif","ch/ch.gif","ci/ci.gif","cl/cl.gif","cm/cm.gif",'\
'"cn/cn.gif","co/co.gif","cr/cr.gif","cu/cu.gif","cv/cv.gif","cz/cz.gif",'\
'"de/de.gif","dj/dj.gif","dk/dk.gif","dm/dm.gif","dz/dz.gif","ec/ec.gif",'\
'"ee/ee.gif","eg/eg.gif","es/es.gif","et/et.gif","fi/fi.gif","fm/fm.gif",'\
'"fr/fr.gif","ga/ga.gif","gd/gd.gif","ge/ge.gif","gh/gh.gif","gm/gm.gif",'\
'"gn/gn.gif","gq/gq.gif","ht/ht.gif","ht/ht.gif","hu/hu.gif","id/id.gif",'\
'"ie/ie.gif","il/il.gif","in/in.gif","iq/iq.gif","ir/ir.gif","is/is.gif",'\
'"it/it.gif","jm/jm.gif","jo/jo.gif","jp/jp.gif","ke/ke.gif","kh/kh.gif",'\
'"ki/ki.gif","km/km.gif","kp/kp.gif","kr/kr.gif","kw/kw.gif","kz/kz.gif",'\
'"la/la.gif","lb/lb.gif","lc/lc.gif","li/li.gif","lk/lk.gif","lr/lr.gif",'\
'"ls/ls.gif","lt/lt.gif","lu/lu.gif","lv/lv.gif","ly/ly.gif","ma/ma.gif",'\
'"mc/mc.gif","md/md.gif","me/me.gif","mg/mg.gif","mh/mh.gif","mk/mk.gif"'

curl -i --globoff -X POST \
   -H "Content-Type:application/json;chartset=UTF-8" \
   -d \
    "{ \"resourcePaths\": [$RESOURCE_PATHS], \"baseUrl\": \"$BASE_URL\", \"lambdaConcur\": 5 }" \
    "$1"