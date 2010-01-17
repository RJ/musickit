#include "qplaydar/query.h"

using namespace Playdar;

Query::Query(QObject *parent) :
    QObject(parent)
{
}
QString Query::str() const { return QString("Query(%1//%2//%3//%4)").arg(m_artist).arg(m_album).arg(m_track).arg(m_qid); }

const QString & Query::qid() const       { return m_qid; }
const QString & Query::artist() const   { return m_artist; }
const QString & Query::album() const    { return m_album; }
const QString & Query::track() const    { return m_track; }
int Query::duration() const             { return m_duration; }
const QList< r_ptr > & Query::results() const
{
    return m_results;
}

void Query::addResult(r_ptr res)
{
    //qDebug() << "addResult " << res;
    // insert result whilst maintaining sorted list on score, descending.
    for(int i=0; i<m_results.length(); i++)
    {
        if(m_results[i]->score() < res->score())
        {
            m_results.insert(i, res);
            goto added;
        }
    }
    m_results.append(res); // not added yet, append on the end
  added:
    qDebug() << "Added result: " << res->str();
    emit(onResult(res));
}
void Query::setQid(const QString& id)        { m_qid = id; }
void Query::setArtist(const QString& name)  { m_artist = name; }
void Query::setAlbum(const QString& name)   { m_album = name; }
void Query::setTrack(const QString& name)   { m_track = name; }
void Query::setDuration(int dur)            { m_duration = dur; }
