#include "playengine.h"

Playengine::Playengine(QObject *parent) :
    QObject(parent)
{
    setupPhonon();
}

Playengine::STATUS Playengine::status() const { return m_status; }

void Playengine::setupPhonon()
{
    source = 0;
    audioOutput = new Phonon::AudioOutput(Phonon::MusicCategory, this);
    mediaObject = new Phonon::MediaObject(this);
    metaInformationResolver = new Phonon::MediaObject(this);
    mediaObject->setTickInterval(1000);

    connect(mediaObject, SIGNAL(tick(qint64)), this, SLOT(tickslot(qint64)));
    connect(mediaObject, SIGNAL(stateChanged(Phonon::State, Phonon::State)),
            this, SLOT(stateChanged(Phonon::State, Phonon::State)));
    connect(metaInformationResolver, SIGNAL(stateChanged(Phonon::State,Phonon::State)),
            this, SLOT(metaStateChanged(Phonon::State, Phonon::State)));
    connect(mediaObject, SIGNAL(currentSourceChanged(const Phonon::MediaSource &)),
            this, SLOT(sourceChanged(const Phonon::MediaSource &)));
    connect(mediaObject, SIGNAL(aboutToFinish()), this, SLOT(aboutToFinish()));
    connect(mediaObject, SIGNAL(bufferStatus(int)), this, SLOT(bufferPercent(int)));

    Phonon::createPath(mediaObject, audioOutput);

    m_status = STOPPED;
}

void Playengine::setVolume(int v)
{
    if(v < 0) v = 0;
    else if(v>100) v = 100;
    audioOutput->setVolume((qreal)v/100);
}

void Playengine::volumeChanged(qreal vr)
{
    int v = (int) vr*100;
    emit(volume(v));
}

void Playengine::togglePause()
{
    switch(m_status)
    {
    case PAUSED:
        qDebug()<<"togglePause when paused";
        mediaObject->play();
        setStatus(PLAYING);
        break;

    case PLAYING:
    case LOADING:
        qDebug()<<"togglePause when playing/loading/buffering";
        mediaObject->pause();
        setStatus(PAUSED);
        break;

    default: ;
        qDebug()<<"togglePause when unknown";
    }

    /*
    switch( mediaObject->state() )
    {
    case Phonon::PausedState:
        qDebug()<<"togglePause when paused";
        mediaObject->play();
        setStatus(PLAYING);
        break;

    case Phonon::PlayingState: // fallthrus - states that we are allowed to pause
    case Phonon::LoadingState:
    case Phonon::BufferingState:
        qDebug()<<"togglePause when playing/loading/buffering";
        mediaObject->pause();
        setStatus(PAUSED);
        break;
    default: ;
        qDebug()<<"togglePause when unknown";
    }
    */
}


void Playengine::play(const QUrl & url)
{
    mediaObject->stop();
    mediaObject->clearQueue();
    if(source) free(source);

    if( (source = new Phonon::MediaSource(url)))
    {
        setStatus(LOADING);
        metaInformationResolver->setCurrentSource(*source);
        mediaObject->setCurrentSource(url);
        mediaObject->play();
    } else {
        qDebug() << "Error: Failed to create source";
        setStatus(ERROR);
    }
}

void Playengine::stop()
{
    mediaObject->stop();
}

void Playengine::bufferPercent(int pc)
{
    qDebug() << "BufferPercent: " << pc;
    emit(buffering(pc));
}

void Playengine::stateChanged(Phonon::State newState, Phonon::State /* oldState */)
 {
     switch (newState) {
         case Phonon::ErrorState:
             if (mediaObject->errorType() == Phonon::FatalError) {
                 setStatus(ERROR);
                 qDebug() << "StateChanged: Fatal error: " + mediaObject->errorString();
             } else {
                 setStatus(ERROR);
                 qDebug() << "StateChanged: error: " + mediaObject->errorString();
             }
             break;
         case Phonon::PlayingState:
             setStatus(PLAYING);
             break;
         case Phonon::StoppedState:
             setStatus(STOPPED);
             break;
         case Phonon::PausedState:
             setStatus(PAUSED);
             break;
         case Phonon::BufferingState:
             //emit(stateChanged());
             break;
         case Phonon::LoadingState:
            setStatus(LOADING);
             break;
        default:
             //emit(stateChanged("unhandledstate"));
             ;
     }
 }

void Playengine::setStatus(Playengine::STATUS s)
{
    m_status = s;
    emit(statusChanged(s));
}

void Playengine::sourceChanged(const Phonon::MediaSource & source)
{
    qDebug() << "Source changed: " + source.url().toString();
}

void Playengine::metaStateChanged(Phonon::State newState, Phonon::State /* oldState */)
 {
    qDebug() << "Metastate changed to " << newState;
     if (newState == Phonon::ErrorState) {
         qDebug() << "ERROR opening files: " + metaInformationResolver->errorString();
         return;
     }

     if (newState != Phonon::StoppedState && newState != Phonon::PausedState)
         return;

     if (metaInformationResolver->currentSource().type() == Phonon::MediaSource::Invalid)
             return;

     qDebug() << "StateChangedOk";
 }

void Playengine::tickslot(qint64 time)
{
    int elap = (int)time/1000;
    int rem  = (int)mediaObject->remainingTime();
    emit(tick(elap, rem));
}

void Playengine::aboutToFinish()
 {
    qDebug()<< "About to finish";
 }

















