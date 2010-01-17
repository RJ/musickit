#ifndef QPLAYDAR
#define QPLAYDAR
#include <QUuid>
#include <QSharedPointer>
#include <QDebug>
#include <QTime>

namespace Playdar
{

    class Utils {
    public:
        static QString guid() {

            QString q = QUuid::createUuid();
            q.remove("{");
            q.remove("}");
            //qDebug() << "UUID: " << q;
            return q;
        };

        static QString mmss(int secs)
        {
            int s = secs % 60;
            int m = (secs-s)/60;
            return QString("%1:%2").arg(m,2,10,QChar('0'))
                                   .arg(s,2,10,QChar('0'));
        };
    };

    class Query;
    class Result;

    typedef QSharedPointer<Playdar::Query> q_ptr;
    typedef QSharedPointer<Playdar::Result> r_ptr;

}

#include "qplaydar/client.h"
#include "qplaydar/result.h"
#include "qplaydar/query.h"

#endif // QPLAYDAR
